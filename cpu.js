import {Memory} from './memory.js'
import fs from 'fs'

export class CPU{
    constructor(){
        this.REG_A = new Number(0x00)
        this.REG_X = new Number(0x00)
        this.REG_Y = new Number(0x00)
        // 3个特殊功能寄存器
        // PC寄存器(Program Counter)
        // SP寄存器(Stack Pointer)
        // PS寄存器(Processor Status)
        this.PC = new Number(0x00FF)
        this.SP = new Number(0xFD)
        this.PS = new Number(0x00)
        // PS寄存器中的标志位
        this.PS_CARRY = 0
        this.PS_ZERO = 0
        this.PS_INTERRUPT = 1
        this.PS_DECIMAL = 0
        this.PS_BREAK = 0
        this.PS_NOTUSED = 1
        this.PS_OVERFLOW = 0
        this.PS_NEGATIVE = 0
        // 中断检查位
        this.INTERRUPT_IRQ = 0
        this.INTERRUPT_BRK = 0
        this.INTERRUPT_NMI = 0
        this.INTERRUPT_RESET = 0
        // 执行指令剩余时钟周期
        this.leftInstructionLoop = 0
        // 寻址跨页时需要增加的时钟周期数
        this.cycleToAdd = 0
        // 操作数长度，由不同的寻址方式决定，指令执行后要增加到PC寄存器上
        this.operationNumberLength = 0
        // 中断向量
        this.RESET = [0xFFFC,0xFFFD]
        // 获取内存对象，此处是映射了rom的内存对象，cpu只认内存，不和卡带rom打交道
        this.memory = Memory.getInstance()
        // 调试用，指令停止
        this.emulateEnd = 0
        // 初始化指令表
        this.initInstruction()
    }

    reset(){
        console.log('CPU reset')
        let resetAddress = (this.memory.load(this.RESET[1]) << 8) + this.memory.load(this.RESET[0])
        this.PC = resetAddress
        this.PC = 0xC000
        fs.unlink("nestest-my.log", err => {
            if (!err) console.log("删除成功");
        });
    }

    execute(){
        let startTime = new Date().getMilliseconds()
        if(this.leftInstructionLoop == 0){
            // 检查是否有中断
            this.checkInterrupt()
            // 取指令
            let instructionCode = this.memory.load(this.PC)
            console.log(instructionCode.toString(16))
            // 指令译码
            // 查表获得指令的类型，时钟周期数，寻址类型
            let instructionType = this.getInstructionType(instructionCode)
            let instructionCycle = this.getCycle(instructionCode)
            let addressMode = this.getAddressMode(instructionCode)
            // 先获取到当前指令的地址值，以便传递给后面函数使用（因为PC要在执行指令前增加，所以不能直接在执行指令时用）
            let currentInstructionAddress = this.PC
            // 执行指令
            // 按不同的寻址模式返回16位2Byte的地址值，提供给后面的执行指令函数来进行相应的读写或者跳转操作
            // 此函数会同时判断操作数的长度，进而得到指令的总长度，以便在执行指令前先修改PC指向下一条指令
            let addressDest = this.findAddress(addressMode,currentInstructionAddress)
            // 增加PC值，指向下一条指令
            this.changePC()
            console.log(addressMode)
            this.showDebug(currentInstructionAddress)
            // 将需要处理的数据传给指令，判断指令的大类后处理数据，参数传递addressMode为累加器寻址使用，因为累加器没有地址，所以需要通过寻址方式来判断
            // 传入当前指令的地址是为了判断要读取的新地址是否跨页了
            this.doInstructionAction(instructionType,addressDest,addressMode,currentInstructionAddress)
            this.leftInstructionLoop += instructionCycle
        }
        this.leftInstructionLoop--  
    }

    checkInterrupt(){

    }

    getInstructionType(instructionCode){
        return this.instructionTypeTable[instructionCode]
    }

    getCycle(instructionCode){
        return this.cycTable[instructionCode]
    }

    getAddressMode(instructionCode){
        return this.instructionAddressModeTable[instructionCode]
    }

    // 按不同的寻址模式得到需要操作的地址，返回该地址的值，供指令进行相应的读写或跳转操作（此函数不应该读数据）
    findAddress(addressMode,currentInstructionAddress){
        // 增加PC寄存器的值，指向要取的操作数
        let addressDest = new Number(0x0000)
        let temp = 0
        this.cycleToAdd = 0
        switch(addressMode){
            // Implicit 指令直接寻址
            case this.addressModeEnum.Implicit:
                this.operationNumberLength = 0
                break
            // Accumulator 累加器A寻址
            case this.addressModeEnum.Accumulator:
                this.operationNumberLength = 0
                break
            // Immediate 立即数寻址，操作数在指令地址后的1Byte直接给出
            case this.addressModeEnum.Immediate:
                addressDest = currentInstructionAddress + 1
                this.operationNumberLength = 1
                break
            // ZeroPage 00-FF的地址被称为ZeroPage，只传递低位1Byte的地址（正常地址时2Byte），地址高位是0x00
            case this.addressModeEnum.ZeroPage:
                addressDest = this.memory.load(currentInstructionAddress + 1) & 0x00FF
                this.operationNumberLength = 1
                break
            // ZeroPage,X 传递过来的1Byte地址，加上寄存器X的值，超出1Byte后取溢出的值，地址高位是0x00
            case this.addressModeEnum.ZeroPageX:
                addressDest = (this.memory.load(currentInstructionAddress + 1) + this.REG_X) & 0x00FF
                this.operationNumberLength = 1
                break
            // ZeroPage,Y 传递过来的1Byte地址，加上寄存器Y的值，超出1Byte后取溢出的值，地址高位是0x00
            case this.addressModeEnum.ZeroPageY:
                addressDest = (this.memory.load(currentInstructionAddress + 1) + this.REG_Y) & 0x00FF
                this.operationNumberLength = 1
                break
            // Relative 相对寻址，当传递过来的操作数小于0x80时，用PC加上该操作数，否则减去该操作数
            // 返回的值是PC增减后的值，需要在执行指令时根据状态寄存器的标志位，来决定是否要用这个值来修改PC，进行跳转
            case this.addressModeEnum.Relative:
                temp = this.memory.load(currentInstructionAddress + 1)
                if(temp < 0x80){
                    // 当前指令地址+1是操作数地址，+2是下一条指令地址，要在下一条指令地址上进行加减
                    addressDest = currentInstructionAddress + 2 + temp
                }
                else{
                    addressDest = currentInstructionAddress + 2 - temp
                }
                this.operationNumberLength = 1
                break
            // Absolute 绝对寻址，直接使用指令后面跟的2Byte操作数
            case this.addressModeEnum.Absolute:
                addressDest = this.memory.load(currentInstructionAddress + 1) | (this.memory.load(currentInstructionAddress + 2) << 8)
                this.operationNumberLength = 2
                break
            // AbsoluteX 绝对寻址加X，直接使用指令后面跟的2Byte操作数 + 寄存器X的内容
            case this.addressModeEnum.AbsoluteX:
                temp = this.memory.load(currentInstructionAddress + 1) | (this.memory.load(currentInstructionAddress + 2) << 8)
                addressDest = (this.memory.load(currentInstructionAddress + 1) | (this.memory.load(currentInstructionAddress + 2) << 8)) + this.REG_X
                // 寻址过程中，ALU会先对地址低位和寄存器中的值相加，如果产生了进位，则需要额外增加一个时钟周期，然后再加上高位地址
                if((temp & 0xFF00) != (addressDest & 0xFF00)){
                    this.cycleToAdd = 1
                }
                this.operationNumberLength = 2
                break
            // AbsoluteY 绝对寻址加Y，直接使用指令后面跟的2Byte操作数 + 寄存器Y的内容
            case this.addressModeEnum.AbsoluteY:
                temp = this.memory.load(currentInstructionAddress + 1) | (this.memory.load(currentInstructionAddress + 2) << 8)
                addressDest = (this.memory.load(currentInstructionAddress + 1) | (this.memory.load(currentInstructionAddress + 2) << 8)) + this.REG_Y
                if((temp & 0xFF00) != (addressDest & 0xFF00)){
                    this.cycleToAdd = 1
                }
                this.operationNumberLength = 2
                break
            // Indirect 间接寻址，JMP指令用，跳转到指令后面2Byte数据组成的地址上的值代表的地址处
            // Ox02FF 的bug
            case this.addressModeEnum.Indirect:
                // 取第一个操作数 应该是 FF
                let indexLoByte = this.memory.load(currentInstructionAddress + 1)
                // 取第二个操作数 应该是 02
                let indexHiByte = this.memory.load(currentInstructionAddress + 2) << 8
                // 组合2个操作数为一个间接地址 应该是02FF
                let indexTempAddress = indexLoByte | indexHiByte
                // 实际地址是要取indexTempAddress处开始2Byte的值组成新地址
                // 取实际跳转地址的低位 应该是 02FF处的值
                let realAddressLo = this.memory.load(indexTempAddress)
                // 取实际跳转地址的高位 如果bug 应该是0200处的值
                let realAddressHi
                if(indexLoByte == 0xFF){
                    realAddressHi = this.memory.load(indexTempAddress & 0xFF00)
                }
                else{
                    realAddressHi = this.memory.load(indexTempAddress + 1)
                }
                addressDest = realAddressLo | realAddressHi << 8
                console.log('JMP '+ 'loByte:'+indexLoByte +';hiByte:'+indexHiByte)
                console.log(addressDest.toString(16))
                this.operationNumberLength = 2
                break
            // IndexedIndirect 变址间接寻址X
            case this.addressModeEnum.IndexedIndirectX:
                // 获取操作数指定的内存位置的值后，和寄存器X相加，然后需要&00FF，防止溢出ZeroPage
                temp = (this.memory.load(currentInstructionAddress + 1) + this.REG_X) & 0x00FF
                console.log('in index')
                console.log(this.memory.load(currentInstructionAddress + 1))
                console.log(this.REG_X)
                console.log('temp:'+ temp.toString(16))
                console.log('lo bit:'+this.memory.load(temp).toString(16))
                console.log('hi bit:'+this.memory.load((temp + 1) & 0x00FF).toString(16))
                let temp1 =  (this.memory.load(temp + 1) << 8)
                console.log('temp1 '+ temp1.toString(2))
                addressDest = (this.memory.load(temp) | (this.memory.load((temp + 1) & 0x00FF) << 8))
                console.log('addressDest:'+addressDest.toString(16))
                this.operationNumberLength = 1
                break
            // IndirectIndexed 间接变址寻址Y
            case this.addressModeEnum.IndirectIndexedY:
                // 获取操作数，写入到indexYOpNum
                let indexYOpNum = this.memory.load(currentInstructionAddress + 1)
                let indexYLoByte = this.memory.load(indexYOpNum)
                let indexYHiByte = this.memory.load((indexYOpNum + 1) & 0x00FF) << 8
                console.log('index y')
                console.log('opNum:'+indexYOpNum.toString(16))
                console.log('LoByte:'+indexYLoByte.toString(16))
                console.log('HiByte:'+indexYHiByte.toString(16))
                addressDest = (indexYLoByte | indexYHiByte) + this.REG_Y
                if(((indexYLoByte | indexYHiByte) & 0xFF00) != (addressDest & 0xFF00)){
                    this.cycleToAdd = 1
                }
                this.operationNumberLength = 1
                break
            default:
                console.log('unknow address mode')
        }
        addressDest = addressDest & 0xFFFF
        return addressDest
    }

    doInstructionAction(instructionType,addressDest,addressMode,currentInstructionAddress){
        //执行指令
        let temp
        switch(instructionType){
            case this.instructionTypeEnum.INS_ADC:
                console.log('ADC')
                temp = (this.REG_A + this.memory.load(addressDest) + this.PS_CARRY)
                // 将操作数看做有符号数，如果相加前两个数符号相同，而结果用补码表示后，与之前操作数符号不同，则认为该结果溢出
                // 即127 + 1 = 128（补码表示-1）溢出，或者-128+(-1)=-129（补码表示+127）溢出
                if((this.REG_A >> 7 ^ this.memory.load(addressDest) >> 7) == 0 && 
                     this.REG_A >> 7 ^ temp >> 7 != 0
                ){
                    this.PS_OVERFLOW = 1
                }
                else{
                    this.PS_OVERFLOW = 0
                }
                this.PS_CARRY = temp > 0xFF ? 1 : 0
                // 取标志位应该&1，防止溢出后取出了溢出位
                this.PS_NEGATIVE = temp >> 7 & 1
                // Zero标志位应该比较溢出截断后的数字
                this.PS_ZERO = (temp & 0xFF) == 0 ? 1 : 0
                this.REG_A = temp & 0xFF
                this.leftInstructionLoop += this.cycleToAdd
                break

            case this.instructionTypeEnum.INS_AND:
                console.log('AND')
                temp = this.REG_A & this.memory.load(addressDest)
                this.PS_NEGATIVE = temp >> 7 
                this.PS_ZERO = (temp == 0 ? 1 : 0)
                this.REG_A = temp
                this.leftInstructionLoop += this.cycleToAdd
                break

            case this.instructionTypeEnum.INS_ASL:
                console.log('ASL')
                if(addressMode == this.addressModeEnum.Accumulator){
                    this.PS_CARRY = this.REG_A >> 7 
                    this.REG_A = (this.REG_A << 1) & 0xFF
                    this.PS_NEGATIVE = this.REG_A >> 7 
                    this.PS_ZERO = this.REG_A == 0 ? 1 : 0
                }
                else{
                    temp = this.memory.load(addressDest);
                    this.PS_CARRY = temp >> 7 
                    temp = (temp << 1) & 0xFF
                    this.PS_NEGATIVE = temp >> 7 
                    this.PS_ZERO = temp == 0 ? 1 : 0
                    this.memory.write(addressDest,temp)
                }
                break

            case this.instructionTypeEnum.INS_BCC:
                console.log('BCC')
                if(this.PS_CARRY == 0){
                    // 分支条件成立，额外增加一个时钟周期
                    this.leftInstructionLoop += 1
                    // 寻址跨页的话需要额外增加一个时钟周期
                    if((currentInstructionAddress & 0xFF00) != (addressDest & 0xFF00)){
                        this.leftInstructionLoop += 1
                    }
                    this.PC = addressDest
                }
                break

            case this.instructionTypeEnum.INS_BCS:
                console.log('BCS')
                if(this.PS_CARRY == 1){
                    // 分支条件成立，额外增加一个时钟周期
                    this.leftInstructionLoop += 1
                    // 寻址跨页的话需要额外增加一个时钟周期
                    if((currentInstructionAddress & 0xFF00) != (addressDest & 0xFF00)){
                        this.leftInstructionLoop += 1
                    }
                    this.PC = addressDest
                }
                break

            case this.instructionTypeEnum.INS_BEQ:
                console.log('BEQ')
                if(this.PS_ZERO == 1){
                    // 分支条件成立，额外增加一个时钟周期
                    this.leftInstructionLoop += 1
                    // 寻址跨页的话需要额外增加一个时钟周期
                    if((currentInstructionAddress & 0xFF00) != (addressDest & 0xFF00)){
                        this.leftInstructionLoop += 1
                    }
                    this.PC = addressDest
                }
                break

            case this.instructionTypeEnum.INS_BIT:
                console.log('BIT')
                temp = this.memory.load(addressDest)
                if((temp & this.REG_A) == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                this.PS_OVERFLOW = temp >> 6 & 1
                this.PS_NEGATIVE = temp >> 7 & 1
                break
            
            case this.instructionTypeEnum.INS_BMI:
                console.log('BMI')
                if(this.PS_NEGATIVE == 1){
                    // 分支条件成立，额外增加一个时钟周期
                    this.leftInstructionLoop += 1
                    // 寻址跨页的话需要额外增加一个时钟周期
                    if((currentInstructionAddress & 0xFF00) != (addressDest & 0xFF00)){
                        this.leftInstructionLoop += 1
                    }
                    this.PC = addressDest
                }
                break
            
            case this.instructionTypeEnum.INS_BNE:
                console.log('BNE')
                if(this.PS_ZERO == 0){
                    // 分支条件成立，额外增加一个时钟周期
                    this.leftInstructionLoop += 1
                    // 寻址跨页的话需要额外增加一个时钟周期
                    if((currentInstructionAddress & 0xFF00) != (addressDest & 0xFF00)){
                        this.leftInstructionLoop += 1
                    }
                    this.PC = addressDest
                }
                break

            case this.instructionTypeEnum.INS_BPL:
                console.log('BPL')
                if(this.PS_NEGATIVE == 0){
                    // 分支条件成立，额外增加一个时钟周期
                    this.leftInstructionLoop += 1
                    // 寻址跨页的话需要额外增加一个时钟周期
                    if((currentInstructionAddress & 0xFF00) != (addressDest & 0xFF00)){
                        this.leftInstructionLoop += 1
                    }
                    this.PC = addressDest
                }
                break

            case this.instructionTypeEnum.INS_BRK:
                console.log('BRK')
                break
    
            case this.instructionTypeEnum.INS_BVC:
                console.log('BVC')
                if(this.PS_OVERFLOW == 0){
                    // 分支条件成立，额外增加一个时钟周期
                    this.leftInstructionLoop += 1
                    // 寻址跨页的话需要额外增加一个时钟周期
                    if((currentInstructionAddress & 0xFF00) != (addressDest & 0xFF00)){
                        this.leftInstructionLoop += 1
                    }
                    this.PC = addressDest
                }
                break

            case this.instructionTypeEnum.INS_BVS:
                console.log('BVS')
                if(this.PS_OVERFLOW == 1){
                    // 分支条件成立，额外增加一个时钟周期
                    this.leftInstructionLoop += 1
                    // 寻址跨页的话需要额外增加一个时钟周期
                    if((currentInstructionAddress & 0xFF00) != (addressDest & 0xFF00)){
                        this.leftInstructionLoop += 1
                    }
                    this.PC = addressDest
                }
                break

            case this.instructionTypeEnum.INS_CLC:
                console.log('CLC')
                this.PS_CARRY = 0
                break

            case this.instructionTypeEnum.INS_CLD:
                console.log('CLD')
                this.PS_DECIMAL = 0
                break

            case this.instructionTypeEnum.INS_CLI:
                console.log('CLI')
                this.PS_INTERRUPT = 0
                break

            case this.instructionTypeEnum.INS_CLV:
                console.log('CLV')
                this.PS_OVERFLOW = 0
                break

            case this.instructionTypeEnum.INS_CMP:
                console.log('CMP')
                temp = this.REG_A - this.memory.load(addressDest)
                this.PS_CARRY = temp >= 0 ? 1 : 0
                if(temp == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if((temp >> 7) & 1 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.leftInstructionLoop += this.cycleToAdd
                break
    
            case this.instructionTypeEnum.INS_CPX:
                console.log('CPX')
                temp = this.REG_X - this.memory.load(addressDest)
                this.PS_CARRY = temp >= 0 ? 1 : 0
                if(temp == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if((temp >> 7) & 1 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                break

            case this.instructionTypeEnum.INS_CPY:
                console.log('CPY')
                temp = this.REG_Y - this.memory.load(addressDest)
                this.PS_CARRY = temp >= 0 ? 1 : 0
                if(temp == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if((temp >> 7) & 1 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                break

            case this.instructionTypeEnum.INS_DEC:
                console.log('DEC')
                temp = (this.memory.load(addressDest) - 1) & 0xFF
                if(temp == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if(temp >> 7 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.memory.write(addressDest,temp)
                break

            case this.instructionTypeEnum.INS_DEX:
                console.log('DEX')
                temp = this.REG_X - 1
                if((temp & 0xFF) == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if((temp & 0xFF)  >> 7 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.REG_X = temp & 0xFF
                break

            case this.instructionTypeEnum.INS_DEY:
                console.log('DEY')
                temp = this.REG_Y - 1
                if((temp & 0xFF) == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if((temp & 0xFF) >> 7 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.REG_Y = temp & 0xFF
                break

            case this.instructionTypeEnum.INS_EOR:
                console.log('EOR')
                temp = this.REG_A ^ this.memory.load(addressDest)
                if(temp == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if(temp >> 7 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.REG_A = temp
                this.leftInstructionLoop += this.cycleToAdd
                break

            case this.instructionTypeEnum.INS_INC:
                console.log('INC')
                temp = (this.memory.load(addressDest) + 1) & 0xFF
                if(temp == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if(temp >> 7 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.memory.write(addressDest,temp)
                break

            case this.instructionTypeEnum.INS_INX:
                console.log('INX')
                temp = this.REG_X + 1
                if((temp & 0xFF)  == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if((temp & 0xFF)  >> 7 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.REG_X = temp & 0xFF
                break

            case this.instructionTypeEnum.INS_INY:
                console.log('INY')
                temp = this.REG_Y + 1
                if((temp & 0xFF) == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if((temp & 0xFF) >> 7 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.REG_Y = temp & 0xFF
                break
    
            case this.instructionTypeEnum.INS_JMP:
                console.log('JMP')
                console.log('JMP Dest:'+addressDest.toString(16))
                this.PC = addressDest
                break
                
            case this.instructionTypeEnum.INS_JSR:
                console.log('JSR')
                this.push((this.PC - 1) >> 8 & 0xFF)
                this.push((this.PC - 1) & 0xFF)
                // console.log(((this.PC - 1) >> 8 & 0xFF).toString(16))
                // console.log(((this.PC - 1) & 0xFF).toString(16))
                this.PC = addressDest
                break

            case this.instructionTypeEnum.INS_LDA:
                console.log('LDA')
                console.log('after LDA')
                console.log(addressDest.toString(16))
                console.log(this.memory.load(addressDest).toString(16))
                this.REG_A = this.memory.load(addressDest) & 0xFF
                // console.log(addressDest.toString(16))
                // console.log(this.REG_A.toString(16))
                if(this.REG_A == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if(this.REG_A >> 7 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.leftInstructionLoop += this.cycleToAdd
                break

            case this.instructionTypeEnum.INS_LDX:
                console.log('LDX')
                console.log(addressDest)
                console.log(this.memory.load(addressDest))
                
                this.REG_X = this.memory.load(addressDest)
                // console.log(this.REG_X.toString(16))
                if(this.REG_X == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if(this.REG_X >> 7 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.leftInstructionLoop += this.cycleToAdd
                break

            case this.instructionTypeEnum.INS_LDY:
                console.log('LDY')
                this.REG_Y = this.memory.load(addressDest)
                if(this.REG_Y == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                if(this.REG_Y >> 7 == 1){
                    this.PS_NEGATIVE = 1
                }
                else{
                    this.PS_NEGATIVE = 0
                }
                this.leftInstructionLoop += this.cycleToAdd
                break

            case this.instructionTypeEnum.INS_LSR:
                console.log('LSR')
                if(addressMode == this.addressModeEnum.Accumulator){
                    this.PS_CARRY = this.REG_A & 1 
                    this.REG_A = (this.REG_A >> 1) & 0xFF
                    this.PS_NEGATIVE = this.REG_A >> 7 
                    this.PS_ZERO = this.REG_A == 0 ? 1 : 0
                }
                else{
                    temp = this.memory.load(addressDest);
                    this.PS_CARRY = temp & 1 
                    temp = (temp >> 1) & 0xFF
                    this.PS_NEGATIVE = temp >> 7 
                    this.PS_ZERO = temp == 0 ? 1 : 0
                    this.memory.write(addressDest,temp)
                }
                break

            case this.instructionTypeEnum.INS_NOP:
                console.log('NOP')
                break

            case this.instructionTypeEnum.INS_ORA:
                console.log('ORA')
                temp = this.REG_A | this.memory.load(addressDest)
                this.PS_NEGATIVE = temp >> 7 
                this.PS_ZERO = temp == 0 ? 1 : 0
                this.REG_A = temp
                this.leftInstructionLoop += this.cycleToAdd
                break
            
            case this.instructionTypeEnum.INS_PHA:
                console.log('PHA')
                this.push(this.REG_A)
                break    

            case this.instructionTypeEnum.INS_PHP:
                console.log('PHP')
                this.push(
                    this.PS_CARRY |
                        (this.PS_ZERO << 1) |
                        (this.PS_INTERRUPT << 2) |
                        (this.PS_DECIMAL << 3) |
                        (1 << 4) |
                        (this.PS_NOTUSED << 5) |
                        (this.PS_OVERFLOW << 6) |
                        (this.PS_NEGATIVE << 7)
                )
                break

            case this.instructionTypeEnum.INS_PLA:
                console.log('PLA')
                this.REG_A = this.pop()
                if(this.REG_A == 0){
                    this.PS_ZERO = 1
                }
                else{
                    this.PS_ZERO = 0
                }
                this.PS_NEGATIVE = (this.REG_A >> 7) & 1
                break 

            case this.instructionTypeEnum.INS_PLP:
                console.log('PLP')
                temp = this.pop()
                this.PS_CARRY = temp & 1;
                this.PS_ZERO = (temp >> 1) & 1;
                this.PS_INTERRUPT = (temp >> 2) & 1;
                this.PS_DECIMAL = (temp >> 3) & 1;
                this.PS_BREAK = (temp >> 4) & 1;
                this.F_NOTUSED = (temp >> 5) & 1;
                this.PS_OVERFLOW = (temp >> 6) & 1;
                this.PS_NEGATIVE = (temp >> 7) & 1;
                break    
        
            case this.instructionTypeEnum.INS_ROL:
                console.log('ROL')
                let rolNewCarry
                if(addressMode == this.addressModeEnum.Accumulator){
                    rolNewCarry = (this.REG_A >> 7) & 1
                    this.REG_A = (this.REG_A << 1 | this.PS_CARRY) & 0xFF
                    this.PS_CARRY = rolNewCarry
                    this.PS_NEGATIVE = (this.REG_A & 0xFF) >> 7 
                    this.PS_ZERO = (this.REG_A & 0xFF) == 0 ? 1 : 0
                }
                else{
                    temp = this.memory.load(addressDest);
                    rolNewCarry = (temp >> 7) & 1
                    temp = (temp << 1 | this.PS_CARRY) & 0xFF
                    this.PS_CARRY = rolNewCarry
                    this.PS_NEGATIVE = (temp & 0xFF) >> 7 
                    this.PS_ZERO = (temp & 0xFF) == 0 ? 1 : 0
                    this.memory.write(addressDest,temp)
                }
                break

            case this.instructionTypeEnum.INS_ROR:
                console.log('ROR')
                let rorNewCarry
                if(addressMode == this.addressModeEnum.Accumulator){
                    rorNewCarry = this.REG_A & 1
                    this.REG_A = (this.REG_A >> 1 | this.PS_CARRY << 7 ) & 0xFF
                    this.PS_CARRY = rorNewCarry
                    this.PS_NEGATIVE = (this.REG_A & 0xFF) >> 7 
                    this.PS_ZERO = (this.REG_A & 0xFF) == 0 ? 1 : 0
                }
                else{
                    temp = this.memory.load(addressDest)
                    rorNewCarry = temp & 1
                    temp = (temp >> 1 | this.PS_CARRY << 7) & 0xFF
                    this.PS_CARRY = rorNewCarry
                    this.PS_NEGATIVE = (temp & 0xFF) >> 7 
                    this.PS_ZERO = (temp & 0xFF) == 0 ? 1 : 0
                    this.memory.write(addressDest,temp)
                }
                break

            case this.instructionTypeEnum.INS_RTI:
                console.log('RTI')
                temp = this.pop()
                this.PS_CARRY = temp & 1;
                this.PS_ZERO = (temp >> 1) & 1;
                this.PS_INTERRUPT = (temp >> 2) & 1;
                this.PS_DECIMAL = (temp >> 3) & 1;
                // this.PS_BREAK = (temp >> 4) & 1;
                // this.F_NOTUSED = (temp >> 5) & 1;
                this.PS_OVERFLOW = (temp >> 6) & 1;
                this.PS_NEGATIVE = (temp >> 7) & 1;
                // RTI弹出标志位后还需要弹出PC地址
                temp = this.pop()
                // console.log(temp)
                temp = (temp | (this.pop() << 8)) & 0xFFFF
                // console.log(temp)
                this.PC = temp
                break    
        
            case this.instructionTypeEnum.INS_RTS:
                console.log('RTS')
                temp = this.pop()
                // console.log(temp)
                temp = (temp | (this.pop() << 8)) & 0xFFFF
                // console.log(temp)
                // RTS弹出的地址少了1
                this.PC = temp + 1
                break    

            case this.instructionTypeEnum.INS_SBC:
                console.log('SBC')
                temp = this.REG_A - this.memory.load(addressDest) - (1 - this.PS_CARRY)
                // 将操作数看做有符号数，如果相减前两个数符号不同，而结果用补码表示后，与之前操作数符号也不同（如果不溢出，负数减去正数后，应该还能保持在负数范围内），则认为该结果溢出
                // 即-128 - 1 = -129（补码表示+127）溢出，或者127 - (-1) = 128（补码表示-1）溢出
                if((this.REG_A >> 7 ^ this.memory.load(addressDest) >> 7) != 0 && 
                     this.REG_A >> 7 ^ temp >> 7 != 0
                ){
                    this.PS_OVERFLOW = 1
                }
                else{
                    this.PS_OVERFLOW = 0
                }
                // js中两数按照有符号数相减，此种情况下，如果要判断减法溢出，可以判断结果是负数
                this.PS_CARRY = temp < 0 ? 0 : 1
                this.PS_NEGATIVE = (temp & 0xFF) >> 7 
                this.PS_ZERO = (temp & 0xFF) == 0 ? 1 : 0
                this.REG_A = temp & 0xFF
                this.leftInstructionLoop += this.cycleToAdd
                break 

            case this.instructionTypeEnum.INS_SEC:
                console.log('SEC')
                this.PS_CARRY = 1
                break

            case this.instructionTypeEnum.INS_SED:
                console.log('SED')
                this.PS_DECIMAL = 1
                break
                        
            case this.instructionTypeEnum.INS_SEI:
                console.log('SEI')
                //PS寄存器I位置1，2时钟周期，1Byte长度
                this.PS_INTERRUPT = 1
                break
            
            case this.instructionTypeEnum.INS_STA:
                console.log('STA')
                this.memory.write(addressDest,this.REG_A)
                break        
            
            case this.instructionTypeEnum.INS_STX:
                console.log('STX')
                this.memory.write(addressDest,this.REG_X)
                break        
        
            case this.instructionTypeEnum.INS_STY:
                console.log('STY')
                this.memory.write(addressDest,this.REG_Y)
                break        
            
            case this.instructionTypeEnum.INS_TAX:
                console.log('TAX')
                this.REG_X = this.REG_A
                this.PS_ZERO = this.REG_X == 0 ? 1 : 0
                this.PS_NEGATIVE = (this.REG_X >> 7) & 1
                break 

            case this.instructionTypeEnum.INS_TAY:
                console.log('TAY')
                this.REG_Y = this.REG_A
                this.PS_ZERO = this.REG_Y == 0 ? 1 : 0
                this.PS_NEGATIVE = (this.REG_Y >> 7) & 1
                break  

            case this.instructionTypeEnum.INS_TSX:
                this.REG_X = this.SP
                this.PS_ZERO = (this.REG_X == 0) ? 1 : 0
                this.PS_NEGATIVE = (this.REG_X >> 7) & 1
                break 

            case this.instructionTypeEnum.INS_TXA:
                console.log('TXA')
                this.REG_A = this.REG_X
                this.PS_ZERO = this.REG_A == 0 ? 1 : 0
                this.PS_NEGATIVE = (this.REG_A >> 7) & 1
                break 

            case this.instructionTypeEnum.INS_TXS:
                console.log('TXS')
                // 低级问题，写的REG_SP，但已经没有了，应该是this.SP
                this.SP = this.REG_X
                break

            case this.instructionTypeEnum.INS_TYA:
                console.log('TYA')
                this.REG_A = this.REG_Y
                this.PS_ZERO = this.REG_A == 0 ? 1 : 0
                this.PS_NEGATIVE = (this.REG_A >> 7) & 1
                break

            default:
                console.log('undefined instruction')
                this.emulateEnd = 1
        }
    }

    changePC(){
        // 修改PC指向的地址值，增加指令长度值（1Byte指令长度+操作数长度），指向下一条指令
        this.PC += (this.operationNumberLength + 1)
    }

    // 初始化指令表
    initInstruction(){
        // 指令周期数
        this.cycTable = new Array(
            /*0x00*/ 7,6,2,8,3,3,5,5,3,2,2,2,4,4,6,6,
            /*0x10*/ 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
            /*0x20*/ 6,6,2,8,3,3,5,5,4,2,2,2,4,4,6,6,
            /*0x30*/ 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
            /*0x40*/ 6,6,2,8,3,3,5,5,3,2,2,2,3,4,6,6,
            /*0x50*/ 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
            /*0x60*/ 6,6,2,8,3,3,5,5,4,2,2,2,5,4,6,6,
            /*0x70*/ 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
            /*0x80*/ 2,6,2,6,3,3,3,3,2,2,2,2,4,4,4,4,
            /*0x90*/ 2,6,2,6,4,4,4,4,2,5,2,5,5,5,5,5,
            /*0xA0*/ 2,6,2,6,3,3,3,3,2,2,2,2,4,4,4,4,
            /*0xB0*/ 2,5,2,5,4,4,4,4,2,4,2,4,4,4,4,4,
            /*0xC0*/ 2,6,2,8,3,3,5,5,2,2,2,2,4,4,6,6,
            /*0xD0*/ 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7,
            /*0xE0*/ 2,6,3,8,3,3,5,5,2,2,2,2,4,4,6,6,
            /*0xF0*/ 2,5,2,8,4,4,6,6,2,4,2,7,4,4,7,7
        )
        // 指令类型枚举
        this.instructionTypeEnum = {
            INS_ADC: 0,
            INS_AND: 1,
            INS_ASL: 2,
            INS_BCC: 3,
            INS_BCS: 4,
            INS_BEQ: 5,
            INS_BIT: 6,
            INS_BMI: 7,
            INS_BNE: 8,
            INS_BPL: 9,
            INS_BRK: 10,
            INS_BVC: 11,
            INS_BVS: 12,
            INS_CLC: 13,

            INS_CLD: 14,
            INS_CLI: 15,
            INS_CLV: 16,
            INS_CMP: 17,
            INS_CPX: 18,
            INS_CPY: 19,
            INS_DEC: 20,
            INS_DEX: 21,
            INS_DEY: 22,
            INS_EOR: 23,
            INS_INC: 24,
            INS_INX: 25,
            INS_INY: 26,
            INS_JMP: 27,

            INS_JSR: 28,
            INS_LDA: 29,
            INS_LDX: 30,
            INS_LDY: 31,
            INS_LSR: 32,
            INS_NOP: 33,
            INS_ORA: 34,
            INS_PHA: 35,
            INS_PHP: 36,
            INS_PLA: 37,
            INS_PLP: 38,
            INS_ROL: 39,
            INS_ROR: 40,
            INS_RTI: 41,

            INS_RTS: 42,
            INS_SBC: 43,
            INS_SEC: 44,
            INS_SED: 45,
            INS_SEI: 46,
            INS_STA: 47,
            INS_STX: 48,
            INS_STY: 49,
            INS_TAX: 50,
            INS_TAY: 51,
            INS_TSX: 52,
            INS_TXA: 53,
            INS_TXS: 54,
            INS_TYA: 55,
            // 非官方指令
            INS_ALR: 56,
            INS_ANC: 57,
            INS_ARR: 58,
            INS_AXS: 59,
            INS_LAX: 60,
            INS_SAX: 61,
            INS_DCP: 62,
            INS_ISC: 63,
            INS_RLA: 64,
            INS_RRA: 65,
            INS_SLO: 66,
            INS_SRE: 67,
            INS_SKB: 68,
            INS_IGN: 69,
            INS_DUMMY: 70
        }
        this.instructionTypeTable = new Array(0xFF)
        // 寻址方式枚举
        this.addressModeEnum = {
            Implicit : 0,
            Accumulator : 1,
            Immediate : 2,
            ZeroPage : 3,
            ZeroPageX : 4,
            ZeroPageY : 5,
            Relative : 6,
            Absolute : 7,
            AbsoluteX : 8,
            AbsoluteY : 9,
            Indirect : 10,
            IndexedIndirectX : 11,
            IndirectIndexedY : 12
        }
        this.instructionAddressModeTable = new Array(0xFF)
        // ADC
        this.instructionTypeTable[0x69] = this.instructionTypeEnum.INS_ADC
        this.instructionAddressModeTable[0x69] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0x65] = this.instructionTypeEnum.INS_ADC
        this.instructionAddressModeTable[0x65] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x75] = this.instructionTypeEnum.INS_ADC
        this.instructionAddressModeTable[0x75] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0x6D] = this.instructionTypeEnum.INS_ADC
        this.instructionAddressModeTable[0x6D] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0x7D] = this.instructionTypeEnum.INS_ADC
        this.instructionAddressModeTable[0x7D] = this.addressModeEnum.AbsoluteX
        this.instructionTypeTable[0x79] = this.instructionTypeEnum.INS_ADC
        this.instructionAddressModeTable[0x79] = this.addressModeEnum.AbsoluteY
        this.instructionTypeTable[0x61] = this.instructionTypeEnum.INS_ADC
        this.instructionAddressModeTable[0x61] = this.addressModeEnum.IndexedIndirectX
        this.instructionTypeTable[0x71] = this.instructionTypeEnum.INS_ADC
        this.instructionAddressModeTable[0x71] = this.addressModeEnum.IndirectIndexedY

        // AND
        this.instructionTypeTable[0x29] = this.instructionTypeEnum.INS_AND
        this.instructionAddressModeTable[0x29] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0x25] = this.instructionTypeEnum.INS_AND
        this.instructionAddressModeTable[0x25] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x35] = this.instructionTypeEnum.INS_AND
        this.instructionAddressModeTable[0x35] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0x2D] = this.instructionTypeEnum.INS_AND
        this.instructionAddressModeTable[0x2D] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0x3D] = this.instructionTypeEnum.INS_AND
        this.instructionAddressModeTable[0x3D] = this.addressModeEnum.AbsoluteX
        this.instructionTypeTable[0x39] = this.instructionTypeEnum.INS_AND
        this.instructionAddressModeTable[0x39] = this.addressModeEnum.AbsoluteY
        this.instructionTypeTable[0x21] = this.instructionTypeEnum.INS_AND
        this.instructionAddressModeTable[0x21] = this.addressModeEnum.IndexedIndirectX
        this.instructionTypeTable[0x31] = this.instructionTypeEnum.INS_AND
        this.instructionAddressModeTable[0x31] = this.addressModeEnum.IndirectIndexedY

        // ASL
        this.instructionTypeTable[0x0A] = this.instructionTypeEnum.INS_ASL
        this.instructionAddressModeTable[0x0A] = this.addressModeEnum.Accumulator
        this.instructionTypeTable[0x06] = this.instructionTypeEnum.INS_ASL
        this.instructionAddressModeTable[0x06] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x16] = this.instructionTypeEnum.INS_ASL
        this.instructionAddressModeTable[0x16] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0x0E] = this.instructionTypeEnum.INS_ASL
        this.instructionAddressModeTable[0x0E] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0x1E] = this.instructionTypeEnum.INS_ASL
        this.instructionAddressModeTable[0x1E] = this.addressModeEnum.AbsoluteX
        
        // BCC
        this.instructionTypeTable[0x90] = this.instructionTypeEnum.INS_BCC
        this.instructionAddressModeTable[0x90] = this.addressModeEnum.Relative
        
        // BCS
        this.instructionTypeTable[0xB0] = this.instructionTypeEnum.INS_BCS
        this.instructionAddressModeTable[0xB0] = this.addressModeEnum.Relative

        // BEQ
        this.instructionTypeTable[0xF0] = this.instructionTypeEnum.INS_BEQ
        this.instructionAddressModeTable[0xF0] = this.addressModeEnum.Relative

        // BIT
        this.instructionTypeTable[0x24] = this.instructionTypeEnum.INS_BIT
        this.instructionAddressModeTable[0x24] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x2C] = this.instructionTypeEnum.INS_BIT
        this.instructionAddressModeTable[0x2C] = this.addressModeEnum.Absolute
        
        // BMI
        this.instructionTypeTable[0x30] = this.instructionTypeEnum.INS_BMI
        this.instructionAddressModeTable[0x30] = this.addressModeEnum.Relative

        // BNE
        this.instructionTypeTable[0xD0] = this.instructionTypeEnum.INS_BNE
        this.instructionAddressModeTable[0xD0] = this.addressModeEnum.Relative

        // BPL
        this.instructionTypeTable[0x10] = this.instructionTypeEnum.INS_BPL
        this.instructionAddressModeTable[0x10] = this.addressModeEnum.Relative

        // BRK
        this.instructionTypeTable[0x00] = this.instructionTypeEnum.INS_BRK
        this.instructionAddressModeTable[0x00] = this.addressModeEnum.Implicit

        // BVC
        this.instructionTypeTable[0x50] = this.instructionTypeEnum.INS_BVC
        this.instructionAddressModeTable[0x50] = this.addressModeEnum.Relative

        // BVS
        this.instructionTypeTable[0x70] = this.instructionTypeEnum.INS_BVS
        this.instructionAddressModeTable[0x70] = this.addressModeEnum.Relative

        // CLC
        this.instructionTypeTable[0x18] = this.instructionTypeEnum.INS_CLC
        this.instructionAddressModeTable[0x18] = this.addressModeEnum.Implicit
        
        // CLD
        this.instructionTypeTable[0xD8] = this.instructionTypeEnum.INS_CLD
        this.instructionAddressModeTable[0xD8] = this.addressModeEnum.Implicit

        // CLI
        this.instructionTypeTable[0x58] = this.instructionTypeEnum.INS_CLI
        this.instructionAddressModeTable[0x58] = this.addressModeEnum.Implicit

        // CLV
        this.instructionTypeTable[0xB8] = this.instructionTypeEnum.INS_CLV
        this.instructionAddressModeTable[0xB8] = this.addressModeEnum.Implicit

        // CMP
        this.instructionTypeTable[0xC9] = this.instructionTypeEnum.INS_CMP
        this.instructionAddressModeTable[0xC9] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0xC5] = this.instructionTypeEnum.INS_CMP
        this.instructionAddressModeTable[0xC5] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0xD5] = this.instructionTypeEnum.INS_CMP
        this.instructionAddressModeTable[0xD5] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0xCD] = this.instructionTypeEnum.INS_CMP
        this.instructionAddressModeTable[0xCD] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0xDD] = this.instructionTypeEnum.INS_CMP
        this.instructionAddressModeTable[0xDD] = this.addressModeEnum.AbsoluteX
        this.instructionTypeTable[0xD9] = this.instructionTypeEnum.INS_CMP
        this.instructionAddressModeTable[0xD9] = this.addressModeEnum.AbsoluteY
        this.instructionTypeTable[0xC1] = this.instructionTypeEnum.INS_CMP
        this.instructionAddressModeTable[0xC1] = this.addressModeEnum.IndexedIndirectX
        this.instructionTypeTable[0xD1] = this.instructionTypeEnum.INS_CMP
        this.instructionAddressModeTable[0xD1] = this.addressModeEnum.IndirectIndexedY

        // CPX
        this.instructionTypeTable[0xE0] = this.instructionTypeEnum.INS_CPX
        this.instructionAddressModeTable[0xE0] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0xE4] = this.instructionTypeEnum.INS_CPX
        this.instructionAddressModeTable[0xE4] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0xEC] = this.instructionTypeEnum.INS_CPX
        this.instructionAddressModeTable[0xEC] = this.addressModeEnum.Absolute

        // CPY
        this.instructionTypeTable[0xC0] = this.instructionTypeEnum.INS_CPY
        this.instructionAddressModeTable[0xC0] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0xC4] = this.instructionTypeEnum.INS_CPY
        this.instructionAddressModeTable[0xC4] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0xCC] = this.instructionTypeEnum.INS_CPY
        this.instructionAddressModeTable[0xCC] = this.addressModeEnum.Absolute

        // DEC
        this.instructionTypeTable[0xC6] = this.instructionTypeEnum.INS_DEC
        this.instructionAddressModeTable[0xC6] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0xD6] = this.instructionTypeEnum.INS_DEC
        this.instructionAddressModeTable[0xD6] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0xCE] = this.instructionTypeEnum.INS_DEC
        this.instructionAddressModeTable[0xCE] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0xDE] = this.instructionTypeEnum.INS_DEC
        this.instructionAddressModeTable[0xDE] = this.addressModeEnum.AbsoluteX

        // DEX
        this.instructionTypeTable[0xCA] = this.instructionTypeEnum.INS_DEX
        this.instructionAddressModeTable[0xCA] = this.addressModeEnum.Implicit
        
        // DEY
        this.instructionTypeTable[0x88] = this.instructionTypeEnum.INS_DEY
        this.instructionAddressModeTable[0x88] = this.addressModeEnum.Implicit
        
        // EOR
        this.instructionTypeTable[0x49] = this.instructionTypeEnum.INS_EOR
        this.instructionAddressModeTable[0x49] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0x45] = this.instructionTypeEnum.INS_EOR
        this.instructionAddressModeTable[0x45] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x55] = this.instructionTypeEnum.INS_EOR
        this.instructionAddressModeTable[0x55] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0x4D] = this.instructionTypeEnum.INS_EOR
        this.instructionAddressModeTable[0x4D] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0x5D] = this.instructionTypeEnum.INS_EOR
        this.instructionAddressModeTable[0x5D] = this.addressModeEnum.AbsoluteX
        this.instructionTypeTable[0x59] = this.instructionTypeEnum.INS_EOR
        this.instructionAddressModeTable[0x59] = this.addressModeEnum.AbsoluteY
        this.instructionTypeTable[0x41] = this.instructionTypeEnum.INS_EOR
        this.instructionAddressModeTable[0x41] = this.addressModeEnum.IndexedIndirectX
        this.instructionTypeTable[0x51] = this.instructionTypeEnum.INS_EOR
        this.instructionAddressModeTable[0x51] = this.addressModeEnum.IndirectIndexedY

        // INC
        this.instructionTypeTable[0xE6] = this.instructionTypeEnum.INS_INC
        this.instructionAddressModeTable[0xE6] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0xF6] = this.instructionTypeEnum.INS_INC
        this.instructionAddressModeTable[0xF6] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0xEE] = this.instructionTypeEnum.INS_INC
        this.instructionAddressModeTable[0xEE] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0xFE] = this.instructionTypeEnum.INS_INC
        this.instructionAddressModeTable[0xFE] = this.addressModeEnum.AbsoluteX

        // INX
        this.instructionTypeTable[0xE8] = this.instructionTypeEnum.INS_INX
        this.instructionAddressModeTable[0xE8] = this.addressModeEnum.Implicit

        // INY
        this.instructionTypeTable[0xC8] = this.instructionTypeEnum.INS_INY
        this.instructionAddressModeTable[0xC8] = this.addressModeEnum.Implicit

        // JMP
        this.instructionTypeTable[0x4C] = this.instructionTypeEnum.INS_JMP
        this.instructionAddressModeTable[0x4C] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0x6C] = this.instructionTypeEnum.INS_JMP
        this.instructionAddressModeTable[0x6C] = this.addressModeEnum.Indirect

        // JSR
        this.instructionTypeTable[0x20] = this.instructionTypeEnum.INS_JSR
        this.instructionAddressModeTable[0x20] = this.addressModeEnum.Absolute

        // LDA
        this.instructionTypeTable[0xA9] = this.instructionTypeEnum.INS_LDA
        this.instructionAddressModeTable[0xA9] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0xA5] = this.instructionTypeEnum.INS_LDA
        this.instructionAddressModeTable[0xA5] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0xB5] = this.instructionTypeEnum.INS_LDA
        this.instructionAddressModeTable[0xB5] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0xAD] = this.instructionTypeEnum.INS_LDA
        this.instructionAddressModeTable[0xAD] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0xBD] = this.instructionTypeEnum.INS_LDA
        this.instructionAddressModeTable[0xBD] = this.addressModeEnum.AbsoluteX
        this.instructionTypeTable[0xB9] = this.instructionTypeEnum.INS_LDA
        this.instructionAddressModeTable[0xB9] = this.addressModeEnum.AbsoluteY
        this.instructionTypeTable[0xA1] = this.instructionTypeEnum.INS_LDA
        this.instructionAddressModeTable[0xA1] = this.addressModeEnum.IndexedIndirectX
        this.instructionTypeTable[0xB1] = this.instructionTypeEnum.INS_LDA
        this.instructionAddressModeTable[0xB1] = this.addressModeEnum.IndirectIndexedY

        // LDX
        this.instructionTypeTable[0xA2] = this.instructionTypeEnum.INS_LDX
        this.instructionAddressModeTable[0xA2] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0xA6] = this.instructionTypeEnum.INS_LDX
        this.instructionAddressModeTable[0xA6] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0xB6] = this.instructionTypeEnum.INS_LDX
        this.instructionAddressModeTable[0xB6] = this.addressModeEnum.ZeroPageY
        this.instructionTypeTable[0xAE] = this.instructionTypeEnum.INS_LDX
        this.instructionAddressModeTable[0xAE] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0xBE] = this.instructionTypeEnum.INS_LDX
        this.instructionAddressModeTable[0xBE] = this.addressModeEnum.AbsoluteY

        // LDY
        this.instructionTypeTable[0xA0] = this.instructionTypeEnum.INS_LDY
        this.instructionAddressModeTable[0xA0] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0xA4] = this.instructionTypeEnum.INS_LDY
        this.instructionAddressModeTable[0xA4] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0xB4] = this.instructionTypeEnum.INS_LDY
        this.instructionAddressModeTable[0xB4] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0xAC] = this.instructionTypeEnum.INS_LDY
        this.instructionAddressModeTable[0xAC] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0xBC] = this.instructionTypeEnum.INS_LDY
        this.instructionAddressModeTable[0xBC] = this.addressModeEnum.AbsoluteX

        // LSR
        this.instructionTypeTable[0x4A] = this.instructionTypeEnum.INS_LSR
        this.instructionAddressModeTable[0x4A] = this.addressModeEnum.Accumulator
        this.instructionTypeTable[0x46] = this.instructionTypeEnum.INS_LSR
        this.instructionAddressModeTable[0x46] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x56] = this.instructionTypeEnum.INS_LSR
        this.instructionAddressModeTable[0x56] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0x4E] = this.instructionTypeEnum.INS_LSR
        this.instructionAddressModeTable[0x4E] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0x5E] = this.instructionTypeEnum.INS_LSR
        this.instructionAddressModeTable[0x5E] = this.addressModeEnum.AbsoluteX

        // NOP
        this.instructionTypeTable[0xEA] = this.instructionTypeEnum.INS_NOP
        this.instructionAddressModeTable[0xEA] = this.addressModeEnum.Implicit

        // ORA
        this.instructionTypeTable[0x09] = this.instructionTypeEnum.INS_ORA
        this.instructionAddressModeTable[0x09] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0x05] = this.instructionTypeEnum.INS_ORA
        this.instructionAddressModeTable[0x05] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x15] = this.instructionTypeEnum.INS_ORA
        this.instructionAddressModeTable[0x15] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0x0D] = this.instructionTypeEnum.INS_ORA
        this.instructionAddressModeTable[0x0D] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0x1D] = this.instructionTypeEnum.INS_ORA
        this.instructionAddressModeTable[0x1D] = this.addressModeEnum.AbsoluteX
        this.instructionTypeTable[0x19] = this.instructionTypeEnum.INS_ORA
        this.instructionAddressModeTable[0x19] = this.addressModeEnum.AbsoluteY
        this.instructionTypeTable[0x01] = this.instructionTypeEnum.INS_ORA
        this.instructionAddressModeTable[0x01] = this.addressModeEnum.IndexedIndirectX
        this.instructionTypeTable[0x11] = this.instructionTypeEnum.INS_ORA
        this.instructionAddressModeTable[0x11] = this.addressModeEnum.IndirectIndexedY

        // PHA
        this.instructionTypeTable[0x48] = this.instructionTypeEnum.INS_PHA
        this.instructionAddressModeTable[0x48] = this.addressModeEnum.Implicit

        // PHP
        this.instructionTypeTable[0x08] = this.instructionTypeEnum.INS_PHP
        this.instructionAddressModeTable[0x08] = this.addressModeEnum.Implicit

        // PLA
        this.instructionTypeTable[0x68] = this.instructionTypeEnum.INS_PLA
        this.instructionAddressModeTable[0x68] = this.addressModeEnum.Implicit

        // PLP
        this.instructionTypeTable[0x28] = this.instructionTypeEnum.INS_PLP
        this.instructionAddressModeTable[0x28] = this.addressModeEnum.Implicit

        // ROL
        this.instructionTypeTable[0x2A] = this.instructionTypeEnum.INS_ROL
        this.instructionAddressModeTable[0x2A] = this.addressModeEnum.Accumulator
        this.instructionTypeTable[0x26] = this.instructionTypeEnum.INS_ROL
        this.instructionAddressModeTable[0x26] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x36] = this.instructionTypeEnum.INS_ROL
        this.instructionAddressModeTable[0x36] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0x2E] = this.instructionTypeEnum.INS_ROL
        this.instructionAddressModeTable[0x2E] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0x3E] = this.instructionTypeEnum.INS_ROL
        this.instructionAddressModeTable[0x3E] = this.addressModeEnum.AbsoluteX

        // ROR
        this.instructionTypeTable[0x6A] = this.instructionTypeEnum.INS_ROR
        this.instructionAddressModeTable[0x6A] = this.addressModeEnum.Accumulator
        this.instructionTypeTable[0x66] = this.instructionTypeEnum.INS_ROR
        this.instructionAddressModeTable[0x66] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x76] = this.instructionTypeEnum.INS_ROR
        this.instructionAddressModeTable[0x76] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0x6E] = this.instructionTypeEnum.INS_ROR
        this.instructionAddressModeTable[0x6E] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0x7E] = this.instructionTypeEnum.INS_ROR
        this.instructionAddressModeTable[0x7E] = this.addressModeEnum.AbsoluteX

        // RTI
        this.instructionTypeTable[0x40] = this.instructionTypeEnum.INS_RTI
        this.instructionAddressModeTable[0x40] = this.addressModeEnum.Implicit

        // RTS
        this.instructionTypeTable[0x60] = this.instructionTypeEnum.INS_RTS
        this.instructionAddressModeTable[0x60] = this.addressModeEnum.Implicit

        // SBC
        this.instructionTypeTable[0xE9] = this.instructionTypeEnum.INS_SBC
        this.instructionAddressModeTable[0xE9] = this.addressModeEnum.Immediate
        this.instructionTypeTable[0xE5] = this.instructionTypeEnum.INS_SBC
        this.instructionAddressModeTable[0xE5] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0xF5] = this.instructionTypeEnum.INS_SBC
        this.instructionAddressModeTable[0xF5] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0xED] = this.instructionTypeEnum.INS_SBC
        this.instructionAddressModeTable[0xED] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0xFD] = this.instructionTypeEnum.INS_SBC
        this.instructionAddressModeTable[0xFD] = this.addressModeEnum.AbsoluteX
        this.instructionTypeTable[0xF9] = this.instructionTypeEnum.INS_SBC
        this.instructionAddressModeTable[0xF9] = this.addressModeEnum.AbsoluteY
        this.instructionTypeTable[0xE1] = this.instructionTypeEnum.INS_SBC
        this.instructionAddressModeTable[0xE1] = this.addressModeEnum.IndexedIndirectX
        this.instructionTypeTable[0xF1] = this.instructionTypeEnum.INS_SBC
        this.instructionAddressModeTable[0xF1] = this.addressModeEnum.IndirectIndexedY
        
        // SEC
        this.instructionTypeTable[0x38] = this.instructionTypeEnum.INS_SEC
        this.instructionAddressModeTable[0x38] = this.addressModeEnum.Implicit

        // SED
        this.instructionTypeTable[0xF8] = this.instructionTypeEnum.INS_SED
        this.instructionAddressModeTable[0xF8] = this.addressModeEnum.Implicit

        // SEI
        this.instructionTypeTable[0x78] = this.instructionTypeEnum.INS_SEI
        this.instructionAddressModeTable[0x78] = this.addressModeEnum.Implicit

        // STA
        this.instructionTypeTable[0x85] = this.instructionTypeEnum.INS_STA
        this.instructionAddressModeTable[0x85] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x95] = this.instructionTypeEnum.INS_STA
        this.instructionAddressModeTable[0x95] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0x8D] = this.instructionTypeEnum.INS_STA
        this.instructionAddressModeTable[0x8D] = this.addressModeEnum.Absolute
        this.instructionTypeTable[0x9D] = this.instructionTypeEnum.INS_STA
        this.instructionAddressModeTable[0x9D] = this.addressModeEnum.AbsoluteX
        this.instructionTypeTable[0x99] = this.instructionTypeEnum.INS_STA
        this.instructionAddressModeTable[0x99] = this.addressModeEnum.AbsoluteY
        this.instructionTypeTable[0x81] = this.instructionTypeEnum.INS_STA
        this.instructionAddressModeTable[0x81] = this.addressModeEnum.IndexedIndirectX
        this.instructionTypeTable[0x91] = this.instructionTypeEnum.INS_STA
        this.instructionAddressModeTable[0x91] = this.addressModeEnum.IndirectIndexedY

        // STX
        this.instructionTypeTable[0x86] = this.instructionTypeEnum.INS_STX
        this.instructionAddressModeTable[0x86] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x96] = this.instructionTypeEnum.INS_STX
        this.instructionAddressModeTable[0x96] = this.addressModeEnum.ZeroPageY
        this.instructionTypeTable[0x8E] = this.instructionTypeEnum.INS_STX
        this.instructionAddressModeTable[0x8E] = this.addressModeEnum.Absolute
        
        // STY
        this.instructionTypeTable[0x84] = this.instructionTypeEnum.INS_STY
        this.instructionAddressModeTable[0x84] = this.addressModeEnum.ZeroPage
        this.instructionTypeTable[0x94] = this.instructionTypeEnum.INS_STY
        this.instructionAddressModeTable[0x94] = this.addressModeEnum.ZeroPageX
        this.instructionTypeTable[0x8C] = this.instructionTypeEnum.INS_STY
        this.instructionAddressModeTable[0x8C] = this.addressModeEnum.Absolute
        
        // TAX  
        this.instructionTypeTable[0xAA] = this.instructionTypeEnum.INS_TAX
        this.instructionAddressModeTable[0xAA] = this.addressModeEnum.Implicit
        
        // TAY
        this.instructionTypeTable[0xA8] = this.instructionTypeEnum.INS_TAY
        this.instructionAddressModeTable[0xA8] = this.addressModeEnum.Implicit

        // TSX
        this.instructionTypeTable[0xBA] = this.instructionTypeEnum.INS_TSX
        this.instructionAddressModeTable[0xBA] = this.addressModeEnum.Implicit

        // TXA
        this.instructionTypeTable[0x8A] = this.instructionTypeEnum.INS_TXA
        this.instructionAddressModeTable[0x8A] = this.addressModeEnum.Implicit

        // TXS
        this.instructionTypeTable[0x9A] = this.instructionTypeEnum.INS_TXS
        this.instructionAddressModeTable[0x9A] = this.addressModeEnum.Implicit

        // TYA
        this.instructionTypeTable[0x98] = this.instructionTypeEnum.INS_TYA
        this.instructionAddressModeTable[0x98] = this.addressModeEnum.Implicit
    }

    // 入栈
    push(data){
        // 栈指针SP是8位的，代表内存中的0x0100——0x01FF 
        let stackPointerAddress = this.SP | 0x0100
        this.memory.write(stackPointerAddress,data)
        this.SP--
    }

    // 出栈
    // 出栈时应该先增加指针，然后弹出栈指针所指位置的数据
    pop(){
        this.SP++
        let stackPointerAddress = this.SP | 0x0100
        // console.log(stackPointerAddress.toString(16))
        let data = this.memory.load(stackPointerAddress)
        return data
    }

    // 调试用
    setInstruction(){
        this.REG_A = 0x01
        let oldPC = this.PC
        this.PC = 0x4000
        this.memory.write(this.PC, 0x69)
        this.memory.write(this.PC + 1, 0x7F)
        
    }

    showDebug(currentInstructionAddress){
        let code = this.toFormattedHex(this.memory.load(currentInstructionAddress),2)
        let codeLength = this.operationNumberLength
        for(let i = 0;i < codeLength; i++){
            code += ' ' + this.toFormattedHex(this.memory.load(currentInstructionAddress + i + 1),2)
        }
        // if(code == 'BE 00 06'){
        //     this.emulateEnd = 1
        //     return
        // }
        let ProcessorStatus = this.PS_CARRY |
        (this.PS_ZERO << 1) |
        (this.PS_INTERRUPT << 2) |
        (this.PS_DECIMAL << 3) |
        (this.PS_BREAK << 4) |
        (this.PS_NOTUSED << 5) |
        (this.PS_OVERFLOW << 6) |
        (this.PS_NEGATIVE << 7)
        console.log('code '+code+';codeLength '+ codeLength)
        console.log(this.toFormattedHex(currentInstructionAddress,4) +'  '
            + 'INS Code:' + code + ' '
            + 'REG_A: '+ this.toFormattedHex(this.REG_A,2)+ '  '
            + 'REG_X: '+ this.toFormattedHex(this.REG_X,2)+ '  '
            + 'REG_Y: '+ this.toFormattedHex(this.REG_Y,2)+ '  '
            + 'P: '+ this.toFormattedHex(ProcessorStatus,2)+ '  '
            + 'Stack Pointer: '+ this.toFormattedHex(this.SP,2)+ '  '
        )
        let data = new Uint8Array(Buffer.from(
            this.toFormattedHex(currentInstructionAddress,4) +'  '
            + this.toFormatString(code,9)
            + 'A:'+ this.toFormattedHex(this.REG_A,2)+ ' '
            + 'X:'+ this.toFormattedHex(this.REG_X,2)+ ' '
            + 'Y:'+ this.toFormattedHex(this.REG_Y,2)+ ' '
            + 'P:'+ this.toFormattedHex(ProcessorStatus,2)+ ' '
            + 'SP:'+ this.toFormattedHex(this.SP,2)+ ' '+'\r\n'
        ))
        // fs.open('nestest-my.log', 'w', (err) => {
        //     if (err) {
        //         return console.error(err);
        //     }    
        // })
        fs.appendFile("nestest-my.log", data, (err)  => {
            if (err) {
                return console.log('追加文件失败')
            }
        })
        // console.log('REG_A: '+this.REG_A)
        // console.log('REG_X: '+this.REG_X)
        // console.log('REG_Y: '+this.REG_Y)
        // console.log('PS_OVERFLOW: '+this.PS_OVERFLOW)
    }

    // 反汇编，通过指令码输出汇编语句
    toDisassembly(instructionCode,currentInstructionAddress){
        let assemblyCode = ''
        return assemblyCode
    }
    
    toFormattedHex(num,length){
        var len = num.toString(16).length
        var outStr = num.toString(16).toUpperCase()
        while(len < length) {
            outStr = '0' + outStr
            len++
        }
        return outStr
    }

    toFormatString(str,length){
        let oldLength = str.length
        for(let i=0;i<length - oldLength;i++){
            str += ' '
        }
        return str
    }
}