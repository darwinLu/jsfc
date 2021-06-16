// PPU可寻址内存
export class PPUMemory{
    constructor(){
        this.instance = null 
        this.mem = new Array(0x3FFF)
        // 初始化PPU寻址内存为全FF
        for(let i = 0;i<0x3FFF;i++){
            this.mem[i] = 0xFF
        }
    }

    static getInstance(){
        if(!this.instance){
            this.instance = new PPUMemory()
            return this.instance
        }
        else{
            return this.instance
        }
    }

    writeToMemory(romData,startAddress,endAddress){
        for(let i=0;i<romData.length;i++){
            this.mem[startAddress+i] = romData[i]
        }
    }

    load(address){
        return this.mem[address]
    }

    write(address,data){
        this.mem[address] = data
    }
}