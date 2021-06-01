import {FC} from './fc.js'
import fs from 'fs'

var jsfc = new FC()
var nesData = fs.readFileSync('./roms/nestest.nes')
jsfc.reset(nesData)