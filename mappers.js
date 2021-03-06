import {Memory} from './memory.js'
import {PPUMemory} from './ppu-memory.js'

var mappers = []

export class Mappers{
    getMapper(mapperId){
        return new mappers[mapperId]
    }
    
}

mappers[0] = class Mapper0 {
    constructor(){
        this.mapperId = 0
        this.romData = null;
        this.PRGRomSize = 0;
        this.CHRRomSize = 0;
        this.memory = Memory.getInstance()
        this.ppuMemory = PPUMemory.getInstance()
    }
    loadHeader(){
        var header = this.getRomData(0x00,0x10)
        this.PRGRomSize = header[4] * 0x4000
        this.CHRRomSize = header[5] * 0x2000
        //此处还可以取到各标志位
    }
    loadPRGRom(){
        var prgRom = this.getRomData(0x10,0x10 + this.PRGRomSize)
        this.memory.writeToMemory(prgRom,0x8000)
        this.memory.writeToMemory(prgRom,0xC000)
    }
    //将图样表映射到PPU可寻址内存的0x0000——0x1FFF
    loadCHRRom(){
        var chrRom = this.getRomData(0x10 + this.PRGRomSize,0x10 + this.PRGRomSize + this.CHRRomSize)
        this.ppuMemory.writeToMemory(chrRom,0x0000)
    }
    setToMemory(romData){
        this.romData = romData
        this.loadHeader()
        this.loadPRGRom()
        this.loadCHRRom()
    }
    getRomData(startAddress,endAddress){
        return this.romData.subarray(startAddress,endAddress)
    }
}


mappers[1] = class Mapper1 extends mappers[0]{
    constructor(){
        super()
        this.mapperId = 1
    }

}