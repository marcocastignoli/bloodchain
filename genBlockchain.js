const sha256 = require('sha256')
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();
const peerId = process.env.GENESIS_BLOCK_PEER

if (peerId) {
    let blocks = []
    let genesisBlock = {
        transactions: [
            { fromAddress: '1h3h12ui3h1i2u3h1iu2hi12ui3h1ui23hi1u2h3iu1h23333', toAddress: peerId, amount: 1000, fee: 0 },
            { fromAddress: peerId, toAddress: '1h3h12ui3h1i2u3h1iu2hi12ui3h1ui23hi1u2h3iu1h23333', amount: 900, fee: 0 },
        ]
    }
    let hash = ''
    const difficulty = 3
    let nonce = 0
    while (hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
        nonce++
        hash = sha256(nonce + JSON.stringify(genesisBlock)).toString()
    }
    genesisBlock.hash = hash
    genesisBlock.nonce = nonce
    blocks.push(genesisBlock)
    fs.writeFile('blockchain', JSON.stringify(blocks), () => {})
    console.log(`Blockchain generated now ${peerId} has 900BLD`)
} else {
    console.log(`ERR: GENESIS_BLOCK_PEER undefined. Add GENESIS_BLOCK_PEER to .env, set yout public ipfs' hash.`)
}