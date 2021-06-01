import {Mappers} from './mappers.js'

export class Rom{
    constructor(){
        this.romData = []
        this.mapper = null;
    }
    loadRom(romData){
        this.romData = romData
        this.analyseRom()
        this.setToMemory()
    }
    analyseRom(){
        //取mapper值
        var header = this.getRomData(0x00,0x10)
        // header[7] = 0b11011111
        // header[6] = 0b00011111
        var mapperId = (header[7] & 0xF0 ) | (header[6] >> 4)
        console.log(mapperId.toString(2))
        //按照mapper值生成mapper
        this.mapper = new Mappers().getMapper(mapperId)
       
    }
    setToMemory(){
        //按照mapper将rom数据映射到内存，供cpu调用
        this.mapper.setToMemory(this.romData)
    }
    getRomData(startAddress,endAddress){
        return this.romData.subarray(startAddress,endAddress)
    }
}