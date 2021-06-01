//mem内存（64KB）
//CPU能寻址的所有地址空间，包括卡带上的空间

export class Memory{
    constructor(){
        this.instance = null 
        this.mem = new Array(0xFFFF)
    }

    static getInstance(){
        if(!this.instance){
            this.instance = new Memory()
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