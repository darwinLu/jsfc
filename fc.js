import {CPU} from './cpu.js'
import {Rom} from './rom.js'


export class FC{
    constructor(romPath){
        this.romPath = romPath
        this.cpu = new CPU()
        this.rom = new Rom()
    }
    
    reset(nesData){
        console.log('fc reset')
        //从nes文件读取到rom
        var romData = nesData
        // console.log(romData)

        //从rom获取mapper编号
        //将rom信息按照mapper规则映射到内存
        this.rom.loadRom(romData)
        //上一步已经把rom映射到内存了，现在resetcpu，开始执行指令了
        // 此处还需要把ppu的内存也提前映射好
        this.cpu.reset()
        //按照mapper编号将rom映射到memory
        //设置reset中断
        //跳转到第一条指令开始执行
        this.onFrame()
    }

    onFrame(){
        for(;;){
            console.log('fc onFrame')
            this.cpu.execute()
            if(this.cpu.emulateEnd == 1){
                break
            }
        }
        console.log('end emulate')
    }
}

// var fc = function(){
//     this.myLoader = new loader()
// }
// cpu.execute()
// fc.myLoader.loadHeader()