const fs = require('fs');
const NodeRSA = require('node-rsa');
const key_test = new NodeRSA({b: 512})

fs.writeFile('public_key', key_test.exportKey('pkcs8-public'), () => {})
fs.writeFile('private_key', key_test.exportKey('pkcs8'), () => {})