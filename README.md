# Bloodychain
Welcome to Bloodchain, this is a - totally not for production - blockchain.
It was Halloween 2019 and I was bored so I decided to learn how blockchains work!

Send a transaction: 
curl -X POST  http://localhost:8888/transaction

Check your balance:
curl -X GET  http://localhost:8888/balance

Check bloodychain's history:
curl -X GET  http://localhost:8888/history

## Install

Install with npm or Yarn
```
yarn Install
```

Generate public and private key
```
yarn gen-key
```

## Start
```
yarn start
```