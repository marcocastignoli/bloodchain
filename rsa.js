const fs = require('fs');
const crypto = require('libp2p-crypto')
const PeerId = require('peer-id')
const NodeRSA = require('node-rsa');
function createFromPrivKey(privateKey) {
    return new Promise(resolve => {
        PeerId.createFromPrivKey(crypto.keys.marshalPrivateKey(privateKey, 'rsa'), async (e, peerId) => {
            if (e) {
                console.log(err)
                return resolve(false)
            }
            resolve(peerId)
        })
    })
}


const key = new NodeRSA({ b: 2048 });
const initPrivateKey = key.exportKey('private')
fs.writeFile('private_key', initPrivateKey, () => { })

async function calculatePeerId(initPrivateKey) {
    const privateKey = await crypto.keys.import(Buffer.from(initPrivateKey), null)
    const peerID = await createFromPrivKey(privateKey)
    const peerJSON = peerID.toJSON()
    console.log('Private key generated, peer id: ' + peerJSON.id)
}

calculatePeerId(initPrivateKey)