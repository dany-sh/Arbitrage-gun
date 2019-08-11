"use strict"

const logger = require("../logger")
const Emitter = require("../emitter/emitter")
const ccxt_controller = require("../exchange/ccxt_controller")

class Order_manager {
  constructor(config) {
    /*config = { exchange, side, symbol, quantity, price }*/
    Object.assign(this, config)
    this.exchangeAPI = ccxt_controller.load_exchange_api(this.exchange)
  }

  async execute() {
    let response
    let filled

    if (this.side == "sell") {
      if (process.env.debug == 1) {
        this.price *= 1.5
      }

      response = await this.exchangeAPI.create_limit_sell_order(this.symbol, this.quantity, this.price)
      filled = await this.follow_order(response.id, response.symbol)
    }
    if (this.side == "buy") {
      if (process.env.debug == 1) {
        this.price *= 0.66
      }

      response = await this.exchangeAPI.create_limit_buy_order(this.symbol, this.quantity, this.price)
      filled = await this.follow_order(response.id, response.symbol)
    }

    logger.verbose(`Order done filled: ${filled}`)

    return filled
  }

  async follow_order(id, symbol) {
    try {
      this.check_order(id, symbol)

      return new Promise(function(resolve, reject) {
        Emitter.once(`${id}/${symbol}`, (msg) => {
          if (msg > 0) {
            resolve(msg)
          } else {
            reject(msg)
          }
        })
      })
    } catch (e) {
      logger.error("Order manager follow order Error ", e)
    }
  }

  async check_order(id, symbol, count = 0) {
    try {
      let order_info = await this.exchangeAPI.fetchOrder(id, symbol)

      logger.verbose(`Follow order status: ${order_info.status} id: ${order_info.id} filled: ${order_info.filled}  time: ${Date.now()}`)

      if (order_info.status == "closed") {
        Emitter.emit(`${id}/${symbol}`, order_info.filled)
        return
      } else if (order_info.status == "canceled") {
        Emitter.emit(`${id}/${symbol}`, 0)
        return
      } else {
        count += 1

        setTimeout(async () => {
          this.check_order(id, symbol, count)
        }, 500)
      }
    } catch (e) {
      logger.error("Trader order check error", e)
      setTimeout(async () => {
        this.check_order(id, symbol, count)
      }, 3000)
    }
  }
}

module.exports = Order_manager
