const NodeRSA = require('node-rsa');
const pow = require('proof-of-work');
const solver = new pow.Solver();

class BloodyNode {
  constructor({ key, ipfs, blocks }) {
    if (!key || !key.private || !key.public) {
      throw 'No key'
    }
    if (!ipfs) {
      throw 'No IPFS'
    }
    if (!blocks) {
      throw 'No blocks'
    }
    this.key = key
    this.ipfs = ipfs
    this.transactions = []
    this.tmpBlock = {
      transactions: []
    }
    this.blocks = blocks
  }
  async mineBlock(block) {
    // cancel if someone has found the hash before or it is taking too long
    const previusBlock = this.blocks[this.blocks.length - 1] ? this.blocks[this.blocks.length - 1] : false
    if (previusBlock) {
      const prefix = Buffer.from(previusBlock.hash.toString() + JSON.stringify(block), 'hex');
      const nonce = solver.solve(17, prefix);
      block.hash = nonce
      return block
    } else {
      return false
    }
  }
  async decrypt(message) {
    let encrypted
    try {
      encrypted = message.data.toString()
    } catch (e) { }
    const name = await this.ipfs.name.resolve(message.from)
    const file = await this.ipfs.cat(name)
    const peerPublicKey = file.toString('utf8')
    const peerRSA = new NodeRSA()
    try {
      peerRSA.importKey(peerPublicKey)
      return peerRSA.decryptPublic(encrypted, 'utf8')
    } catch {
      return false
    }
  }
  verifyTransaction(fromAddress, transaction) {
    if (fromAddress !== transaction.fromAddress) {
      return false
    }
    const amountToSend = transaction.amount
    const fee = transaction.fee
    let balance = this.balance(fromAddress)
    if (amountToSend + fee < balance) {
      return true
    } else {
      return false
    }
  }
  blockAlreadyExists(block) {
    return this.blocks.find(b => b.hash === block.hash) ? true : false
  }
  async addTransactionToTmpBlock(transactionMessage) {
    let transaction = JSON.parse(await this.decrypt(transactionMessage))
    if (transaction) {
      if (this.verifyTransaction(transactionMessage.from, transaction)) {
        this.tmpBlock.transactions.push(transaction)
      }
    }
    if (this.tmpBlock.transactions.length === BloodyNode.BLOCK_SIZE) {
      const block = await this.mineBlock(this.tmpBlock)
      if (!this.blockAlreadyExists(block)) {
        const selfRSA = new NodeRSA(this.key.private)
        const message = selfRSA.encryptPrivate(JSON.stringify(block), 'base64')
        await this.ipfs.pubsub.publish(BloodyNode.TOPIC_BLOCKS, message)
      }
      this.tmpBlock = { transactions: [] }
    }
  }
  async addTransaction(transactionMessage) {
    this.transactions.push(transactionMessage)
    if (this.tmpBlock.transactions.length < BloodyNode.BLOCK_SIZE) {
      this.addTransactionToTmpBlock(this.transactions[0])
    }
  }
  async verifyBlock(blockMessage) {
    const block = JSON.parse(await this.decrypt(blockMessage))
    block.hash = Buffer.from(block.hash)
    const previusBlock = this.blocks[this.blocks.length - 1] ? this.blocks[this.blocks.length - 1] : false
    if (previusBlock) {
      const blockClone = Object.assign({}, block);
      delete blockClone.hash;
      const prefix = Buffer.from(previusBlock.hash.toString() + JSON.stringify(blockClone), 'hex');
      const verifier = new pow.Verifier({
        size: 1024,
        n: 16,
        complexity: 17,
        prefix: prefix
      });
      if (verifier.check(block.hash)) {
        this.blocks.push(block)
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  }
  history() {
    return this.blocks
  }
  balance(address) {
    let balance = 0
    for (let b of this.blocks) {
      for (let t of b.transactions) {
        if (t.fromAddress === address) {
          balance -= t.amount;
        }
        if (t.toAddress === address) {
          balance += t.amount;
        }
      }
    }
    return balance
  }
  async sendTransaction(transaction) {
    transaction.fromAddress = (await this.ipfs.id()).id
    if (!this.verifyTransaction(transaction.fromAddress, transaction)) {
      return false
    }
    const selfRSA = new NodeRSA(this.key.private)
    const message = selfRSA.encryptPrivate(JSON.stringify(transaction), 'base64')
    await this.ipfs.pubsub.publish(BloodyNode.TOPIC_TRANSACTIONS, message)
    return true
  }
  async start() {
    const file = await this.ipfs.add(Buffer.from(this.key.public))
    await this.ipfs.name.publish(file[0].hash)
    await this.ipfs.pubsub.subscribe(BloodyNode.TOPIC_TRANSACTIONS, this.addTransaction.bind(this))
    await this.ipfs.pubsub.subscribe(BloodyNode.TOPIC_BLOCKS, this.verifyBlock.bind(this))
    return true
  }
  static async create({ key, ipfs, blocks }) {
    const node = new BloodyNode({
      ipfs: ipfs,
      key: key,
      blocks: blocks
    })
    await node.start()
    return node
  }
}

BloodyNode.TOPIC_TRANSACTIONS = 'TRANSACTIONS'
BloodyNode.TOPIC_BLOCKS = 'BLOCKS'
BloodyNode.BLOCK_SIZE = 1

module.exports = BloodyNode