const { expectRevert, time } = require('@openzeppelin/test-helpers');
const PaiMaster = artifacts.require('PaiMaster');
const PaiToken = artifacts.require('PaiToken');
const PaiLock = artifacts.require('PaiLock');

contract('PaiLock', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.pai = await PaiToken.new({ from: alice });
        this.master = await PaiMaster.new(this.pai.address, bob, '1000', '0', { from: alice });
        this.paiLock = await PaiLock.new(this.pai.address, this.master.address, { from: alice });
    });

    it('should deposit PaiLock Token success', async () => {
        const totalSupply = await this.paiLock.totalSupply();
        assert.equal(totalSupply.valueOf(), '1');
        await this.pai.transferOwnership(this.master.address, { from: alice });
        await this.master.add('100', this.paiLock.address, false);
        await time.advanceBlockTo('8');
        await this.paiLock.deposit('0', { from: alice });
        await time.advanceBlockTo('10');
        assert.equal((await this.master.pendingPai(0, this.paiLock.address)).valueOf(), '1000');
        await this.paiLock.withdrawFromPaiMaster('0', { from: alice });
        assert.equal(await this.pai.balanceOf(this.paiLock.address).valueOf(), '2000');

        await this.paiLock.setwithdrawContractAddr(carol);
        assert.equal(await this.paiLock.withDrawAddr().valueOf(), carol);

        await this.paiLock.withdrawToContract(50);
        assert.equal(await this.pai.balanceOf(this.paiLock.address).valueOf(), '1950');
        assert.equal(await this.pai.balanceOf(carol).valueOf(), '50');
    });
})