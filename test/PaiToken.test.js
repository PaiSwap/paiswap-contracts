const { expectRevert } = require('@openzeppelin/test-helpers');
const PaiToken = artifacts.require('PaiToken');

contract('PaiToken', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.pai = await PaiToken.new({ from: alice });
    });

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.pai.name();
        const symbol = await this.pai.symbol();
        const decimals = await this.pai.decimals();
        assert.equal(name.valueOf(), 'PaiToken');
        assert.equal(symbol.valueOf(), 'PAI');
        assert.equal(decimals.valueOf(), '18');
    });

    it('should only allow owner to mint token', async () => {
        await this.pai.mint(alice, '100', { from: alice });
        await this.pai.mint(bob, '1000', { from: alice });
        await expectRevert(
            this.pai.mint(carol, '1000', { from: bob }),
            'Ownable: caller is not the owner',
        );
        const totalSupply = await this.pai.totalSupply();
        const aliceBal = await this.pai.balanceOf(alice);
        const bobBal = await this.pai.balanceOf(bob);
        const carolBal = await this.pai.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '100');
        assert.equal(bobBal.valueOf(), '1000');
        assert.equal(carolBal.valueOf(), '0');
    });

    it('should supply token transfers properly', async () => {
        await this.pai.mint(alice, '100', { from: alice });
        await this.pai.mint(bob, '1000', { from: alice });
        await this.pai.transfer(carol, '10', { from: alice });
        await this.pai.transfer(carol, '100', { from: bob });
        const totalSupply = await this.pai.totalSupply();
        const aliceBal = await this.pai.balanceOf(alice);
        const bobBal = await this.pai.balanceOf(bob);
        const carolBal = await this.pai.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '90');
        assert.equal(bobBal.valueOf(), '900');
        assert.equal(carolBal.valueOf(), '110');
    });

    it('should fail if you try to do bad transfers', async () => {
        await this.pai.mint(alice, '100', { from: alice });
        await expectRevert(
            this.pai.transfer(carol, '110', { from: alice }),
            'ERC20: transfer amount exceeds balance',
        );
        await expectRevert(
            this.pai.transfer(carol, '1', { from: bob }),
            'ERC20: transfer amount exceeds balance',
        );
    });

    it('should update vote of delegatee when delegator transfers', async () => {
        await this.pai.mint(alice, '100', { from: alice });
        await this.pai.delegate(bob, { from: alice });
        assert.equal(await this.pai.getCurrentVotes(alice), '0');
        assert.equal(await this.pai.getCurrentVotes(bob), '100');
        await this.pai.mint(alice, '100', { from: alice });
        assert.equal(await this.pai.getCurrentVotes(bob), '200');
        await this.pai.mint(carol, '100', { from: alice });
        await this.pai.transfer(alice, '50', { from: carol });
        assert.equal(await this.pai.getCurrentVotes(bob), '250');
        await this.pai.delegate(carol, { from: alice });
        assert.equal(await this.pai.getCurrentVotes(bob), '0');
        assert.equal(await this.pai.getCurrentVotes(carol), '250');
    });
  });
