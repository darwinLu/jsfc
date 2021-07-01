import {PPUMemory} from './ppu-memory.js'

export class PPU{
    constructor(){
        this.instance = null 
        this.vmemory = PPUMemory.getInstance()
        // PPU地址指针
        this.ppuAddress = 0x0000
        // PPU数据输入输出缓冲
        this.ppuDataBuffer = 0x00
        // CPU向PPU写数据时，要延迟一次获取完整地址，靠此标志位控制 
        this.firstWrite = true
        // PPU寄存器

        // $2000
        this.PPUCTRL_TABLE_NAME_LOW = 0
        this.PPUCTRL_TABLE_NAME_HI = 0
        this.PPUCTRL_VRAM_INCREMENT = 0
        this.PPUCTRL_SPRITE_NAMETABLE_ADD = 0
        this.PPUCTRL_BACKGROUND_NAMETABLE_ADD = 0
        // 在VBLANK时是否可以触发NMI，1为可以触发
        this.PPUCTRL_ENABLE_NMI = 0

        // $2001

        // $2002
        // PPU是否处于VBLANK，在第241线第1点时置1，进入VBLANK，读取PPUSTATUS寄存器后置0
        this.PPUSTATUS_VBLANK_START = 0

        // $2003
        // $2004
        // $2005
        this.PPUSCROLL = 0x00
        // $2006
        // CPU需要写VRAM时用来指定地址的寄存器，需要写2次才能指定VRAM地址，写先写高字节（只有6bit有效），后写低字节
        this.PPUADDR = 0x00
        
        // $2007
        // 要写入显存的数据，PPU的指针会在这个寄存器读写后按照$2002的bit2来增加1或32
        // 通常读写会在VBLANK进行
        // 写这个寄存器应该同时改VRAM的内容 
        this.PPUDATA = 0x00

        this.initPalette()
        // 当前扫描线，初始化为-1
        this.scanline = -1
        // 当前像素点位置，初始化为0
        this.pixelX = 0
        // 是否触发nim中断
        this.nim = false
    }

    static getInstance(){
        if(!this.instance){
            this.instance = new PPU()
            return this.instance
        }
        else{
            return this.instance
        }
    }
    reset(){
        // console.log('PPU reset')
    }
    // PPU每次执行会决定1个像素点，然后写入到需要前台输出的缓冲中
    // 实际的PPU是每次执行时直接向屏幕输出1个像素，但模拟时可以等到1帧的像素全部确定后，在用绘图API绘制到屏幕
    // 暂时先实现帧同步，一次性输出所有像素点
    execute(buffer,cpu){
        console.log('-------------------------------------------------')
        // 输出patternTable
        // var tempLine = ''
        // let lineStart = 0x0000
        // for(let i=0x0000;i<0x1000;i++){
        //     tempLine += this.vmemory.load(i).toString(16) + ' '
        //     if(i - lineStart == 31){
        //         console.log(tempLine)
        //         tempLine = ''
        //         lineStart = i + 1
        //     }
        // }
        // 输出名称表
        // var tempLine = ''
        // let lineStart = 0x2000
        // for(let i=0x2000;i<0x23C0;i++){
        //     tempLine += this.vmemory.load(i).toString(16) + ' '
        //     if(i - lineStart == 31){
        //         console.log(tempLine)
        //         tempLine = ''
        //         lineStart = i + 1
        //     }
        // }
        
                
        // }

        // console.log('in PPU execute')
        // 输出CPU内存位置0x2000的PPU寄存器值
        // 输出256*240 = 61440个像素点
        // for(let i=0;i<61440;i++){
        //     // 向屏幕缓冲区填充随机像素
        //     // buffer[curCycle] = this.toFormattedHex(parseInt(Math.random()*256).toString(16),2)
        //     // // console.log(buffer[curCycle])
        //     buffer[i] = 0xFF000000 | this.toFormattedHex(parseInt(Math.random()*256*256*256).toString(16),6)
        // }
        // 按照nameTable中的数据输出背景像素
        // 从显存的0x2000处开始取数据，取出第一屏的960个tile
        // for(let i=0x2000;i<0x23C0;i++){
        //     // 解析每一个tile，获取它指向的PatternTabel的代码
        //     let tileCode = this.vmemory.load(i)
        //     // console.log('tileCode:'+tileCode)
        //     // 有了tileCode，能直到图样的形状位置位于显存的0x0000+tileCode地址处，分为前后各8Byte
        //     // 所以应该一次性读取16Byte，然后拆分成前8Byte和后8Byte
        //     // 此时已经通过PatternTable获取到了需要渲染的图案形状，只需再通过这两个点阵加上属性表来确定实际的颜色，然后逐个输出就可以了
        //     // 先不取颜色，尝试只把点阵输出，取前8Byte中64个像素点对应位置的bit值和后8Byte中64个像素点的bit值相加，得到0-3的值，然后设置4中默认颜色来输出
        //     let patternFrontLine1 = this.vmemory.load(tileCode)
        //     let patternBackLine1 = this.vmemory.load(tileCode + 8)
        //     // // console.log('f:'+patternFrontLine1 +';b:'+patternBackLine1)
        //     for(let j=0;j<7;j++){
        //         let bit0 = patternFrontLine1 >> j & 1
        //         let bit1 = patternBackLine1 >> j & 1
        //         let bit = bit0 + bit1
        //         if(bit == 0){
        //             buffer[j] = 0xFF000000 | 0xFFFFFF
        //         }
        //         if(bit == 1){
        //             buffer[j] = 0xFF000000 | 0x000000
        //         }
        //         if(bit == 2){
        //             buffer[j] = 0xFF000000 | 0x00FFFF
        //         }
        //         if(bit == 3){
        //             buffer[j] = 0xFF000000 | 0x00FF00
        //         }
        //     }
        // }
        // 每帧渲染到屏幕后通知CPU进行NMI
        this.PPUSTATUS_VBLANK_START = 1
        if(this.PPUCTRL_ENABLE_NMI == 1){
            // 将名称表输出到屏幕缓冲区
            for(let i=0x2000;i<0x23C0;i++){
                // 获取到一个tile
                let tile = this.vmemory.load(i)
                let myTile = new Tile(tile)
                myTile.getPatternAddress()
                myTile.fillPixelColorMartix()
                myTile.showPixelColorMartix()
                // let tileLine = (i - 0x2000) / 32
                // let tileRow = (i - 0x2000) % 32
                // // 在patternTable中找到这个tile的连续
                // // 如果tile的16进制数为TT，则它在patternTable中的位置是0x0TT0到0x0TTF，总共16字节，2个平面
                // // 或者是0x1TT0到0x1TTF，总共16字节，2个平面，这取决于PPU寄存器中的状态
                // // 先默认取0x0TT0的位置，尝试输出
                // let temp = tile << 4 & 0x1FF0
                // for(let j=0;j<8;j++){
                //     let frontByte = this.vmemory.load(j + temp)
                //     let backByte = this.vmemory.load(j + temp + 8)
                //     for(let k=0;k<8;k++){
                //         let frontBit = frontByte >> (7 - k) & 1
                //         let backBit = backByte >> (7 - k) & 1
                //         let resultIndex = frontBit + backBit
                //         let selectColor
                //         switch (resultIndex){
                //             case 0:
                //                 selectColor = 0x000000
                //                 break
                //             case 1:
                //                 selectColor = 0xFF0000
                //                 break
                //             case 2:
                //                 selectColor = 0x00FF00
                //                 break
                //             case 3:
                //                 selectColor = 0x0000FF
                //                 break
                //         }

                //         // console.log('index :'+ (i - 0x2000) * 64 + j*8 + k)
                //         // console.log(0xFF000000 | selectColor)
                //         buffer[tileLine * 256 * 8 + j * 256 + tileRow * 8 +  k] = 0xFF000000 | selectColor
                //         // buffer[parseInt(i - 0x2000) * 64 + j*8 + k] = 0xFF000000 | this.toFormattedHex(parseInt(Math.random()*256*256*256).toString(16),6)
                //     }
                // }
            }
            cpu.INTERRUPT_NMI = 1
        }
            

        // // 预备阶段
        // // console.log(this.scanline+';'+this.pixelX)
        // if(this.scanline == -1){
        //     cpu.INTERRUPT_NMI = 0
        // }
        // // 正常渲染，需要计算出1个像素的颜色
        // if(this.scanline >= 0 && this.scanline < 240){
        //     // 只有0-255共256个像素点有颜色
        //     if(this.pixelX < 256)
        //     buffer[this.scanline * 256 + this.pixelX] = 0xFF000000 | this.toFormattedHex(parseInt(Math.random()*256*256*256).toString(16),6)

        //     // buffer[curCycle] = 0xFF000000 | this.toFormattedHex(parseInt(Math.random()*256*256*256).toString(16),6)
        // }
        // // TO FIX NMI中断，其实不应在这触发
        // if(this.scanline == 240){
        //     cpu.INTERRUPT_NMI = 1
        // }
        // // 走一个像素点
        // this.pixelX++
        // // 走完一行像素，增加扫描线行数到下一行
        // if(this.pixelX > 341){
        //     this.scanline++
        //     this.pixelX = 0
        // }
        // // // console.log('ppu execute')

    }
    setBuffer(buffer){
        
    }
    writePPUCTRL(data){
        this.PPUCTRL_TABLE_NAME_LOW = data & 1
        this.PPUCTRL_TABLE_NAME_HI = data >> 1 & 1
        this.PPUCTRL_VRAM_INCREMENT = data >> 2 & 1
        this.PPUCTRL_SPRITE_NAMETABLE_ADD = data >> 3 & 1
        this.PPUCTRL_BACKGROUND_NAMETABLE_ADD = data >> 4 & 1
        // 在VBLANK时是否可以触发NMI，1为可以触发
        this.PPUCTRL_ENABLE_NMI = data >> 7 & 1
    }
    readPPUSTATUS(){
        // console.log('reading PPUSTATUS')
        let status
        if(this.PPUSTATUS_VBLANK_START == 1){
            console.log('vblank status == 1')
        }
        status = this.PPUSTATUS_VBLANK_START << 7 | 0x00 
        this.PPUSTATUS_VBLANK_START = 0
        if(status == 0x80){
            console.log('PPU status:'+status.toString(16))
        }

        return status
    }
    // 第一次写高8位，第二次写低8位，然后只取14位
    writeVRAMAddress(data){
        if(this.firstWrite){
            console.log('fistWriteAdd high byte:'+data.toString(16))
            this.ppuAddress = data << 8 & 0x3F00
            console.log('after first write :'+ this.ppuAddress.toString(16))
        }
        else{
            console.log('second write :'+ data.toString(16))
            console.log('last address is:'+ this.ppuAddress)
            this.ppuAddress = this.ppuAddress | (data & 0x00FF)
            console.log('after second write :'+ this.ppuAddress.toString(16))
        }
        this.firstWrite = !this.firstWrite
    }
    readData(){
        let data = this.vmemory[this.ppuAddress]
        this.ppuAddress += this.PPUCTRL_VRAM_INCREMENT == 0 ? 1 : 32
        return data
    }

    writeVRAM(data){
        // console.log('CPU is writing VRAM,add:'+this.ppuAddress.toString(16)+';data:'+data.toString
        // (16))
        this.vmemory.write(this.ppuAddress,data)
        this.ppuAddress += this.PPUCTRL_VRAM_INCREMENT == 0 ? 1 : 32
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
    initPalette(){
        //64色调色盘RGB表示
        this.palette = 
        [0x525252, 0xB40000, 0xA00000, 0xB1003D, 0x740069, 0x00005B, 0x00005F, 0x001840,
         0x002F10, 0x084A08, 0x006700, 0x124200, 0x6D2800, 0x000000, 0x000000, 0x000000,
         0xC4D5E7, 0xFF4000, 0xDC0E22, 0xFF476B, 0xD7009F, 0x680AD7, 0x0019BC, 0x0054B1,
         0x006A5B, 0x008C03, 0x00AB00, 0x2C8800, 0xA47200, 0x000000, 0x000000, 0x000000,
         0xF8F8F8, 0xFFAB3C, 0xFF7981, 0xFF5BC5, 0xFF48F2, 0xDF49FF, 0x476DFF, 0x00B4F7, 
         0x00E0FF, 0x00E375, 0x03F42B, 0x78B82E, 0xE5E218, 0x787878, 0x000000, 0x000000, 
         0xFFFFFF, 0xFFF2BE, 0xF8B8B8, 0xF8B8D8, 0xFFB6FF, 0xFFC3FF, 0xC7D1FF, 0x9ADAFF, 
         0x88EDF8, 0x83FFDD, 0xB8F8B8, 0xF5F8AC, 0xFFFFB0, 0xF8D8F8, 0x000000, 0x000000]
    }

}

class Tile{
    constructor(patternCode){
        this.vmemory = PPUMemory.getInstance()
        this.patternCode = patternCode
        this.pixelColorMartix = new Array(8)
        for(let i=0;i<this.pixelColorMartix.length;i++){
            this.pixelColorMartix[i] = new Array('0','0','0','0','0','0','0','0')
        }
    }
    getPatternAddress(){
        this.first8ByteStartAddress = this.patternCode << 4 & 0x0FF0
        this.second8ByteStartAddress = this.first8ByteStartAddress + 8
        // console.log('first 8Byte:'+first8ByteStartAddress.toString(16)+';second 8Byte:'+second8ByteStartAddress.toString(16))
    }
    fillPixelColorMartix(){
        let line1Byte = this.vmemory.load(this.first8ByteStartAddress)
        for(let i=0;i<8;i++){
            this.pixelColorMartix[1][i] = line1Byte >> (7 - i) & 1
        }
    }
    showPixelColorMartix(){
        for(let i=0;i<8;i++){
            let tempLine = ''
            for(let j=0;j<8;j++){
                tempLine += this.pixelColorMartix[i][j] + ' '
            }
            console.log(tempLine)
        }
    }
    showName(){
        console.log(this.patternCode.toString(16).toUpperCase())
    }
    
}