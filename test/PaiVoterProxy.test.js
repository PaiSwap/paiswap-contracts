const { expectRevert } = require('@openzeppelin/test-helpers');
const PaiToken = artifacts.require('PaiToken');
const PaiMaster = artifacts.require('PaiMaster');
const PaiBar = artifacts.require('PaiBar');
const PaiVoterProxy = artifacts.require('PaiVoterProxy');
const MockERC20 = artifacts.require('MockERC20');
const PaiSwapPair = artifacts.require('PaiSwapPair');
const PaiSwapFactory = artifacts.require('PaiSwapFactory');

const TOTAL_SUPPLY = 10000000;
const LP_SUPPLY    = 1000000;

contract('PaiVoterProxy', ([alice, bob, carol, dev, minter]) => {
    beforeEach(async () => {
        this.paiToken = await PaiToken.new({ from: alice });
        await this.paiToken.mint(minter, TOTAL_SUPPLY, { from: alice });
        this.paiMaster = await PaiMaster.new(this.paiToken.address, dev, '1000', '0', { from: alice });
        this.PaiBar = await PaiBar.new(this.paiToken.address,{ from: alice });
        this.paiVoterProxy = await PaiVoterProxy.new(this.paiToken.address, this.paiMaster.address,this.PaiBar.address, { from: alice });
    });

    it('check totalSupply', async () => {
        await this.paiToken.mint(alice, '10000', { from: alice });
        await this.paiToken.mint(bob, '10000', { from: alice });
        await this.paiToken.mint(carol, '10000', { from: alice });
        //sqrt(10030000)
        assert.equal((await this.paiVoterProxy.totalSupply()).valueOf(), '3167');
        await this.paiToken.mint(carol, '50000', { from: alice });
        //sqrt(10080000)
        assert.equal((await this.paiVoterProxy.totalSupply()).valueOf(), '3174');
        await this.paiToken.mint(bob, '50000', { from: alice });
        //sqrt(10130000)
        assert.equal((await this.paiVoterProxy.totalSupply()).valueOf(), '3182');
        this.paiVoterProxy.setSqrtEnable(false, { from: alice });
        assert.equal((await this.paiVoterProxy.totalSupply()).valueOf(), '10130000');
        this.paiVoterProxy.setSqrtEnable(true, { from: alice });
        assert.equal((await this.paiVoterProxy.totalSupply()).valueOf(), '3182');
        //paibar enter
        await this.paiToken.approve(this.PaiBar.address, '10000', { from: carol });
        await this.PaiBar.enter('10000',{ from: carol });
        //sqrt(10140000)
        assert.equal((await this.paiVoterProxy.totalSupply()).valueOf(), '3184');
        await this.paiVoterProxy.setPow(2,1,0, { from: alice });
        // totalSupply = //sqrt(10130000)
        assert.equal((await this.paiVoterProxy.totalSupply()).valueOf(), '3182');
        await this.paiVoterProxy.setPow(2,1,2, { from: alice });
        // totalSupply = //sqrt(10150000)
        assert.equal((await this.paiVoterProxy.totalSupply()).valueOf(), '3185');
    });

    it('check votePools api', async () => {
        // assert.equal((await this.paiVoterProxy.getVotePoolNum()).valueOf(), '5');
        // assert.equal((await this.paiVoterProxy.getVotePoolId(1)).valueOf(), '32');
        await expectRevert(this.paiVoterProxy.addVotePool(5,{ from: bob }),'Not Owner');
        // assert.equal((await this.paiVoterProxy.getVotePoolNum()).valueOf(), '5');
        this.paiVoterProxy.addVotePool('5', { from: alice });
        // assert.equal((await this.paiVoterProxy.getVotePoolNum()).valueOf(), '6');
        // assert.equal((await this.paiVoterProxy.getVotePoolId(3)).valueOf(), '34');
        // assert.equal((await this.paiVoterProxy.getVotePoolId(5)).valueOf(), '5');
        await expectRevert(this.paiVoterProxy.delVotePool('5', { from: bob }),'Not Owner');
        // assert.equal((await this.paiVoterProxy.getVotePoolNum()).valueOf(), '6');
        this.paiVoterProxy.delVotePool('5', { from: alice });
        // assert.equal((await this.paiVoterProxy.getVotePoolNum()).valueOf(), '5');
        // assert.equal((await this.paiVoterProxy.getVotePoolId(2)).valueOf(), '33');
        // this.paiVoterProxy.addVotePool('9', { from: alice });
        // assert.equal((await this.paiVoterProxy.getVotePoolNum()).valueOf(), '6');
        // assert.equal((await this.paiVoterProxy.getVotePoolId(5)).valueOf(), '9');
    });

    it('check balanceOf', async () => {
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '0');
        this.factory0 = await PaiSwapFactory.new(alice, { from: alice });
        this.factory32 = await PaiSwapFactory.new(alice, { from: alice });
        this.factory33 = await PaiSwapFactory.new(alice, { from: alice });
        this.factory34 = await PaiSwapFactory.new(alice, { from: alice });
        await this.paiToken.transferOwnership(this.paiMaster.address, { from: alice });
        this.token0 = await MockERC20.new('TToken', 'TOKEN0', TOTAL_SUPPLY, { from: minter });
        this.lp0 = await PaiSwapPair.at((await this.factory0.createPair(this.token0.address, this.paiToken.address)).logs[0].args.pair);
        await this.token0.transfer(this.lp0.address, LP_SUPPLY, { from: minter });
        await this.paiToken.transfer(this.lp0.address, LP_SUPPLY, { from: minter });
        await this.lp0.mint(minter);
        await this.paiMaster.add('10000', this.lp0.address, true);
        for(i=1;i<32;i++)
        {
            this.lptemp = await MockERC20.new('LPToken', 'TOKEN', TOTAL_SUPPLY, { from: minter });
            await this.paiMaster.add('10000', this.lptemp.address, true);
        }
        this.token32 = await MockERC20.new('TToken', 'Token32', TOTAL_SUPPLY, { from: minter });
        this.lp32 = await PaiSwapPair.at((await this.factory32.createPair(this.token32.address, this.paiToken.address)).logs[0].args.pair);
        await this.token32.transfer(this.lp32.address, LP_SUPPLY, { from: minter });
        await this.paiToken.transfer(this.lp32.address, LP_SUPPLY, { from: minter });
        await this.lp32.mint(minter);
        await this.paiMaster.add('10000', this.lp32.address, true);
        this.token33 = await MockERC20.new('TToken', 'TOKEN33', TOTAL_SUPPLY, { from: minter });
        this.lp33 = await PaiSwapPair.at((await this.factory33.createPair(this.token33.address, this.paiToken.address)).logs[0].args.pair);
        await this.token33.transfer(this.lp33.address, LP_SUPPLY, { from: minter });
        await this.paiToken.transfer(this.lp33.address, LP_SUPPLY, { from: minter });
        await this.lp33.mint(minter);
        await this.paiMaster.add('10000', this.lp33.address, true);
        this.token34 = await MockERC20.new('LPToken', 'TOKEN34', TOTAL_SUPPLY, { from: minter });
        this.lp34 = await PaiSwapPair.at((await this.factory34.createPair(this.token34.address, this.paiToken.address)).logs[0].args.pair);
        await this.token34.transfer(this.lp34.address, LP_SUPPLY, { from: minter });
        await this.paiToken.transfer(this.lp34.address, LP_SUPPLY, { from: minter });
        await this.lp34.mint(minter);
        await this.paiMaster.add('10000', this.lp34.address, true);
        //null pool will destroy 1000 lp_token
        // console.log("get minter lp0",(await this.lp0.balanceOf(minter)).valueOf());
        // console.log("get minter vote",(await this.paiVoterProxy.balanceOf(minter)).valueOf());
        await this.lp0.approve(this.paiMaster.address, '10000', { from: minter });
        await this.paiMaster.deposit(0, '10000', { from: minter });
        //sqrt(6020000)
        assert.equal((await this.paiVoterProxy.balanceOf(minter)).valueOf(), '2453');
        await this.lp32.approve(this.paiMaster.address, '20000', { from: minter });
        await this.paiMaster.deposit(32, '10000', { from: minter });
        //sqrt(6040000)
        assert.equal((await this.paiVoterProxy.balanceOf(minter)).valueOf(), '2457');

        await this.lp0.transfer(bob, '20000', { from: minter });
        await this.lp0.approve(this.paiMaster.address, '20000', { from: bob });
        await this.paiMaster.deposit(0, '10000', { from: bob });
        //sqrt(20000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '141');
        await this.lp32.transfer(bob, '20000', { from: minter });
        await this.lp32.approve(this.paiMaster.address, '20000', { from: bob });
        await this.paiMaster.deposit(32, '20000', { from: bob });
        //sqrt(60000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '244');
        await this.lp34.transfer(bob, '20000', { from: minter });
        await this.lp34.approve(this.paiMaster.address, '20000', { from: bob });
        await this.paiMaster.deposit(34, '20000', { from: bob });
        //sqrt(100000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '316');
        await this.paiMaster.withdraw(34, '10000', { from: bob });
        //sqrt(80000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '282');

        //no votepool deposit
        this.factory35 = await PaiSwapFactory.new(alice, { from: alice });
        this.token35 = await MockERC20.new('TToken', 'TOKE35', TOTAL_SUPPLY, { from: minter });
        this.lp35 = await PaiSwapPair.at((await this.factory35.createPair(this.token35.address, this.paiToken.address)).logs[0].args.pair);
        await this.token35.transfer(this.lp35.address, LP_SUPPLY, { from: minter });
        await this.paiToken.transfer(this.lp35.address, LP_SUPPLY, { from: minter });
        await this.lp35.mint(minter);
        await this.paiMaster.add('10000', this.lp35.address, true);
        await this.lp35.transfer(bob, '20000', { from: minter });
        await this.lp35.approve(this.paiMaster.address, '20000', { from: bob });
        await this.paiMaster.deposit(35, '20000', { from: bob });
        //sqrt(80000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '282');
        //add votepool 35
        await this.paiVoterProxy.addVotePool('35', { from: alice });
        //sqrt(120000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '346');
        await this.paiMaster.withdraw(35, '10000', { from: bob });
        //sqrt(100000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '316');
        //del votepool 35
        await this.paiVoterProxy.delVotePool('35', { from: alice });
        //sqrt(80000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '282');

        // test xpai voter
        //bob 20000 pai , 40000 lp_pai 
        await this.paiToken.transfer(bob, 20000, { from: minter });
        //paibar enter
        await this.paiToken.approve(this.PaiBar.address, '10000', { from: bob });
        await this.PaiBar.enter('10000',{ from: bob });
        ////bob 10000 pai , 40000 lp_pai , 10000 xpai
        //sqrt(100000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '316');
        
        //test setPow
        await this.paiVoterProxy.setPow(2,1,0, { from: alice });
        // voter = sqrt(2*40000+1*10000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '300');
        await this.paiVoterProxy.setPow(1,1,0, { from: alice });
        //voter = sqrt(1*40000+1*10000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '223');
        await this.paiVoterProxy.setPow(1,1,2, { from: alice });
        //voter = sqrt(1*40000+1*10000+2*10000)
        assert.equal((await this.paiVoterProxy.balanceOf(bob)).valueOf(), '264');
    });
});
