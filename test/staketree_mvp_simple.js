var StakeTreeMVP = artifacts.require("./StakeTreeMVP.sol");

const ERROR_INVALID_OPCODE = 'VM Exception while processing transaction: invalid opcode';
const ERROR_SETNEXTWITHDRAWAL_PRIVATE = 'instance.setNextWithdrawalTime is not a function';

contract('StakeTreeMVP', function(accounts) {
  let instance;

  const account_a = accounts[0]; // Beneficiary
  const account_b = accounts[1];
  const account_c = accounts[2];

  const account_d = accounts[3];
  const account_e = accounts[4];
  const account_f = accounts[5];

  const nowUnix = new Date().getTime()/1000 - 3000;
  const nowParsed = parseInt(nowUnix.toFixed(0), 10);

  let deployed = false;

  const config = {
    beneficiaryAddress: account_a,
    withdrawalPeriod: 3000,
    startTime: nowParsed
  };

  beforeEach(async () => {
    if(!deployed) {
      instance = await StakeTreeMVP.new(
        config.beneficiaryAddress, 
        config.withdrawalPeriod, 
        config.startTime, 
      {from: account_a});
      deployed = true;
    }
  });

  describe('Init & unit tests of pure functions', async () => {
    it("should have set beneficiary address during deploy", async () => {
      const beneficiary = await instance.getBeneficiary.call();
      assert.equal(beneficiary, account_a, "Beneficiary address has been set");
    });

    it("should have correct minimum funding amount", async () => { 
      const min = await instance.minimumFundingAmount.call();
      assert.equal(min, 1, "Minimum amount is set correctly to 1 wei");
    });

    it("should have set withdrawal timeframe correctly", async () => {
      const withdrawalPeriod = await instance.withdrawalPeriod.call();
      assert.equal(withdrawalPeriod, config.withdrawalPeriod, "Withdrawal period correctly");
    });

    it("should have initial next withdrawal period in correct timeframe", async () => {
      const withdrawalPeriod = await instance.withdrawalPeriod.call();
      const nextWithdrawal = await instance.nextWithdrawal.call();
      const lastWithdrawal = await instance.lastWithdrawal.call();
      const timingIsCorrect = lastWithdrawal['c'][0] + withdrawalPeriod['c'][0] == nextWithdrawal['c'][0];
      assert.equal(timingIsCorrect, true, "Contract withdrawal timing is correctly setup");
    });

    it("should get initial balance of contract", async () => {
      const balance = await instance.getBalance.call();
      assert.equal(balance, 0, "Contract initiated with 0 balance");
    });

    it("should calculate withdrawal amount", async () => {
      const amount = await instance.calculateWithdrawalAmount.call(1000);
      assert.equal(amount, 100, "Calculated withdrawal amount");
    });
  });

  describe('Account A unit testing', async () => {
    it("[account a] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_a, to: instance.address, value: 1000});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 1000, "Contract has 1000 wei balance");
    });

    it("[account a] should show funds of funder", async () => {
      const balance = await instance.balanceOf.call(account_a);
      assert.equal(balance, 1000, "Account A has 1000 wei balance");
    });

    it("should get total funders", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });

    it("[account a] should add more funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_a, to: instance.address, value: 1000});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 2000, "Contract has 2000 wei balance");
    });

    it("[account a] should show funds of funder increased", async () => {
      const balance = await instance.balanceOf.call(account_a);
      assert.equal(balance, 2000, "Account A has 2000 wei balance");
    });

    it("should still get total funders as 1", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });
  });

  describe('Add account b integration testing', async () => {
    it("[account b] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_b, to: instance.address, value: 500});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 2500, "Contract has 2500 wei balance");
    });

    it("[account b] should show funds of funder", async () => {
      const balance = await instance.balanceOf.call(account_b);
      assert.equal(balance, 500, "Account B has 500 wei balance");
    });

    it("should get total funders as 2", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 2, "There are 2 total funders");
    });
  });
  
  describe('Withdrawal testing', async () => {
    it("should withdraw to beneficiary", async () => {
      await instance.withdrawToBeneficiary();
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 2250, "Beneficiary has withdrawn 10%");
    });

    it("should fail withdrawing to beneficiary", async () => {
      try {
        await instance.withdrawToBeneficiary();
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("should get withdrawal counter", async () => {
      const counter = await instance.getWithdrawalCounter.call();
      assert.equal(counter, 1, "Withdrawal counter is 1");
    });
  });

  describe('Refund testing', async () => {
    it("should fail to refund if refunding done by different account", async () => {
      try {
        await instance.refundByFunder(account_a, {from: account_b});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("[account a] should refund by funder", async () => {
      await instance.refundByFunder(account_a, {from: account_a});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 450, "Account A has been refunded 1800. Wallet balance is now 450");
    });

    it("should get total funders as 1", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });

    it("[account b] should refund by funder", async () => {
      await instance.refundByFunder(account_b, {from: account_b});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 0, "Account B has been refunded 450. Wallet balance is now 0");
    });

    it("should get total funders as 0", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 0, "There are 0 total funders");
    });
  });
});