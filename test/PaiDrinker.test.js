const { expectRevert, time } = require('@openzeppelin/test-helpers');
const PaiToken = artifacts.require('PaiToken');
const MockERC20 = artifacts.require('MockERC20');
const PaiSwapPair = artifacts.require('PaiSwapPair');
const PaiSwapFactory = artifacts.require('PaiSwapFactory');
const PaiDrinker = artifacts.require('PaiDrinker');

contract('PaiDrinker', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.factory = await PaiSwapFactory.new(alice, { from: alice });
        this.pai = await PaiToken.new({ from: alice });
        await this.pai.mint(alice, '100000000', { from: alice });
        this.uni = await MockERC20.new('UNI', 'UNI', '100000000', { from: alice });
        this.paiuni = await PaiSwapPair.at((await this.factory.createPair(this.pai.address, this.uni.address)).logs[0].args.pair);
        this.blackHoldAddress = '0000000000000000000000000000000000000001';
        this.drinker = await PaiDrinker.new(this.factory.address, this.pai.address, this.uni.address);
    });

    it('only owner can set factory', async () => {
        assert.equal(await this.drinker.owner(), alice);
        assert.equal(await this.drinker.factory(), this.factory.address);
        await expectRevert(this.drinker.setFactory(bob, { from: bob }), 'only owner');
        await this.drinker.setFactory(bob, { from: alice });
        assert.equal(await this.drinker.factory(), bob);
    });

    it('should convert uni to pai successfully', async () => {
        // add liquidity
        await this.pai.transfer(this.paiuni.address, '100000', { from: alice });
        await this.uni.transfer(this.paiuni.address, '100000', { from: alice });
        await this.paiuni.sync();
        await this.pai.transfer(this.paiuni.address, '10000000', { from: alice });
        await this.uni.transfer(this.paiuni.address, '10000000', { from: alice });
        await this.paiuni.mint(alice);

        await this.uni.transfer(this.drinker.address, '1000');
        await this.drinker.convert();
        assert.equal(await this.uni.balanceOf(this.drinker.address), '0');
        assert.equal(await this.pai.balanceOf(this.blackHoldAddress), '996');
    });
})