// import

//function deployFunc(hre) {
//  console.log('Hi!')
//}
//module.exports.default = deployFunc

// hardhat always provides the hre as a prop for the function. The hre is the hardhat runtime environment, which is equivalent to require('hardhat')
// {getNamedAccounts, deployments} = hre
const { networkConfig, developmentChains } = require('../helper-hardhat-config')
const { network } = require('hardhat')
require('dotenv').config()
const { verify } = require('../utils/verify')

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log, get } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId

  // If chainId is X, use address Y
  let ethUsdPriceFeedAddress

  // If we are in a dev chain, we get the priceFeed address from our mock aggregator, otherwise we take it from our networkConfig
  if (developmentChains.includes(network.name)) {
    const ethUsdAggregator = await get('MockV3Aggregator')
    ethUsdPriceFeedAddress = ethUsdAggregator.address
  } else {
    ethUsdPriceFeedAddress = networkConfig[chainId]['ethUsdPriceFeed']
  }

  // If the contract does not exist, we deploy a minimal version for our local testing

  // What happens when we want to change chains?
  // When going for localhost for hardhat network we want to use a mock
  const args = [ethUsdPriceFeedAddress]

  const fundMe = await deploy('FundMe', {
    from: deployer,
    args: args, //Put priceFeed address
    log: true,
    waitConfirmations: network.config.blockConfirtmations || 1,
  })

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(fundMe.address, args)
  }
  log('-----------------------------------------')
}

module.exports.tags = ['all', 'fundme']
