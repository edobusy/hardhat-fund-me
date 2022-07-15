const { assert } = require('chai')
const { network, ethers, getNamedAccounts } = require('hardhat')
const { developmentChains } = require('../../helper-hardhat-config')

developmentChains.includes(network.name)
  ? describe.skip
  : describe('FundMe Staging Tests', async function () {
      let deployer
      let fundMe
      const sendValue = ethers.utils.parseEther('0.1')
      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        console.log('First step')
        fundMe = await ethers.getContract('FundMe', deployer)
        console.log('Second step')
      })

      it('allows people to fund and withdraw', async function () {
        await fundMe.fund({ value: sendValue })
        console.log('Third step')
        await fundMe.withdraw()
        console.log('Fourth step')
        const endingFundMeBalance = await fundMe.provider.getBalance(
          fundMe.address
        )
        console.log(
          endingFundMeBalance.toString() +
            ' should equal 0, running assert equal...'
        )
        assert.equal(endingFundMeBalance.toString(), '0')
        console.log('Last step')
      })
    })
