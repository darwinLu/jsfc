import {FC} from './fc.js'
import fs from 'fs'

var jsfc = new FC()
var nesData = fs.readFileSync('./roms/nestest.nes')
jsfc.reset(nesData)

// 定时执行，没有UI看不到效果
for(let i=0;i<5;i++){
    jsfc.onFrame()
}
