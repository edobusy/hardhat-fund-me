const { assert, expect } = require('chai')
const { deployments, ethers, getNamedAccounts, network } = require('hardhat')
const { developmentChains } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name)
  ? describe.skip
  : describe('FundMe', async function () {
      let fundMe
      let deployer
      let mockV3Aggregator
      const sendValue = ethers.utils.parseEther('1')
      beforeEach(async function () {
        // Deploy our fundMe contract using Hardhat-deploy

        // We can also do await ethers.getSigners(), which returns the accounts specified in the hardhat.config.js
        // const accounts = await ethers.getSigners()
        // const accountZero = accounts[0]
        deployer = (await getNamedAccounts()).deployer

        // deployments.fixture let us deploy all our scripts in deploy folder with the tags we want
        await deployments.fixture(['all'])
        // getContract will give us the most recent deployed contract of the selected type
        fundMe = await ethers.getContract('FundMe', deployer)

        mockV3Aggregator = await ethers.getContract(
          'MockV3Aggregator',
          deployer
        )
      })

      describe('constructor', async function () {
        it('Sets the aggregator addresses correctly', async function () {
          const response = await fundMe.getPriceFeed()
          assert.equal(response, mockV3Aggregator.address)
        })
      })

      describe('receive', async function () {
        it('Should call fund when no data is included', async function () {
          const [account] = await ethers.getSigners()
          const transaction = await account.sendTransaction({
            to: fundMe.address,
            value: sendValue,
            gasLimit: 500000,
            gasPrice: ethers.utils.parseUnits('10', 'gwei'),
          })
          assert.equal(
            await fundMe.getAddressToAmountFunded(account.address),
            sendValue.toString()
          )
        })

        it("Fails if you don't send enough ETH, after calling fund", async function () {
          const [account] = await ethers.getSigners()

          await expect(
            account.sendTransaction({
              to: fundMe.address,
              value: ethers.utils.parseEther('0.0001'),
              gasLimit: 500000,
              gasPrice: ethers.utils.parseUnits('10', 'gwei'),
            })
          ).to.be.revertedWith('You need to spend more ETH!')
        })
      })

      describe('fallback', async function () {
        it('Should call fund when data is included', async function () {
          const [account] = await ethers.getSigners()
          const transaction = await account.sendTransaction({
            to: fundMe.address,
            value: sendValue,
            gasLimit: 500000,
            gasPrice: ethers.utils.parseUnits('10', 'gwei'),
            data: '0x00',
          })
          assert.equal(
            await fundMe.getAddressToAmountFunded(account.address),
            sendValue.toString()
          )
        })

        it("Fails if you don't send enough ETH, after calling fund", async function () {
          const [account] = await ethers.getSigners()

          await expect(
            account.sendTransaction({
              to: fundMe.address,
              value: ethers.utils.parseEther('0.0001'),
              gasLimit: 500000,
              gasPrice: ethers.utils.parseUnits('10', 'gwei'),
              data: '0x00',
            })
          ).to.be.revertedWith('You need to spend more ETH!')
        })
      })

      describe('fund', async function () {
        it("Fails if you don't send enough ETH", async function () {
          await expect(fundMe.fund()).to.be.revertedWith(
            'You need to spend more ETH!'
          )
        })

        it('Updated the amount funded data structure', async function () {
          await fundMe.fund({
            value: sendValue,
          })

          const response = await fundMe.getAddressToAmountFunded(deployer)

          assert.equal(response.toString(), sendValue.toString())
        })

        it('Adds funder to array of funders', async function () {
          await fundMe.fund({ value: sendValue })
          const funder = await fundMe.getFunder(0)

          assert.equal(funder, deployer)
        })
      })

      describe('withdraw', async function () {
        beforeEach(async function () {
          await fundMe.fund({ value: sendValue })
        })

        it('Can withdraw ETH from a single founder', async function () {
          // Arrange
          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          )
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          )
          // Act
          const transactionResponse = await fundMe.withdraw()
          const transactionReceipt = await transactionResponse.wait(1)

          const { gasUsed, effectiveGasPrice } = transactionReceipt
          const gasCost = gasUsed.mul(effectiveGasPrice)

          const endingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          )
          const endingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          )
          // Assert
          assert.equal(endingFundMeBalance, 0)
          // Initial deployer balance + funds from contract should equal the current deployer balance + the gas he spent to withdraw the funds
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            endingDeployerBalance.add(gasCost).toString()
          )
        })

        it('Allows us to withdraw with multiple funders', async function () {
          // Arrange
          const accounts = await ethers.getSigners()

          for (let i = 1; i < 6; i++) {
            const fundMeConnectedContract = await fundMe.connect(accounts[i])
            await fundMeConnectedContract.fund({ value: sendValue })
          }

          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          )
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          )

          // Act
          const transactionResponse = await fundMe.withdraw()
          const transactionReceipt = await transactionResponse.wait(1)
          const { gasUsed, effectiveGasPrice } = transactionReceipt
          const gasCost = gasUsed.mul(effectiveGasPrice)

          const endingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          )
          const endingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          )

          // Assert
          assert.equal(endingFundMeBalance, 0)

          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            endingDeployerBalance.add(gasCost).toString()
          )

          // Make sure the funders are reset properly
          await expect(fundMe.getFunder(0)).to.be.reverted

          for (i = 1; i < 6; i++) {
            assert.equal(
              await fundMe.getAddressToAmountFunded(accounts[i].address),
              0
            )
          }
        })

        it('Only allows the owner to withdraw', async function () {
          const accounts = await ethers.getSigners()
          const fundMeConnectedContract = await fundMe.connect(accounts[1])
          //let error
          //   try {
          //     await fundMeConnectedContract.withdraw()
          //   } catch (e) {
          //     console.log(e.toString())
          //     error = e
          //   }
          //   expect(error.toString()).to.include('FundMe__NotOwner()')
          await expect(fundMeConnectedContract.withdraw()).to.be.revertedWith(
            'You are not the owner of this contract!'
          )
        })

        it('cheaperWithdraw testing...', async function () {
          // Arrange
          const accounts = await ethers.getSigners()

          for (let i = 1; i < 6; i++) {
            const fundMeConnectedContract = await fundMe.connect(accounts[i])
            await fundMeConnectedContract.fund({ value: sendValue })
          }

          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          )
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          )

          // Act
          const transactionResponse = await fundMe.cheaperWithdraw()
          const transactionReceipt = await transactionResponse.wait(1)
          const { gasUsed, effectiveGasPrice } = transactionReceipt
          const gasCost = gasUsed.mul(effectiveGasPrice)

          const endingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          )
          const endingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          )

          // Assert
          assert.equal(endingFundMeBalance, 0)

          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            endingDeployerBalance.add(gasCost).toString()
          )

          // Make sure the funders are reset properly
          await expect(fundMe.getFunder(0)).to.be.reverted

          for (i = 1; i < 6; i++) {
            assert.equal(
              await fundMe.getAddressToAmountFunded(accounts[i].address),
              0
            )
          }
        })
      })
    })
