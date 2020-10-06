const { expectRevert, time, BN } = require('@openzeppelin/test-helpers');
const PaiToken = artifacts.require('PaiToken');
const PaiUni = artifacts.require('PaiUni');
const StakingRewards = artifacts.require('StakingRewards');
const MockERC20 = artifacts.require('MockERC20');

contract('PaiUni', ([alice, bob, carol, jim, minter]) => {
    beforeEach(async () => {
        this.pai = await PaiToken.new({ from: alice });
        this.uniToken = await MockERC20.new("UniSwap", "UNI", "1000000000000000000000000000", { from: alice });
    });

    it('should set correct state variables', async () => {
        const paiUni = await PaiUni.new(this.pai.address, this.uniToken.address, bob, carol, "50", "0", { from: alice });
        assert.equal((await paiUni.pai()).valueOf(), this.pai.address);
        assert.equal((await paiUni.uniToken()).valueOf(), this.uniToken.address);
        assert.equal((await paiUni.owner()).valueOf(), alice);
        assert.equal((await paiUni.uniTokenFeeReceiver()).valueOf(), bob);
        assert.equal((await paiUni.lpTokenFeeReceiver()).valueOf(), carol);
        assert.equal((await paiUni.paiPerBlock()).valueOf(), "50");
        assert.equal((await paiUni.startBlock()).valueOf(), "0");
        assert.equal((await paiUni.endBlock()).valueOf(), "128000");
        assert.equal((await paiUni.bonusEndBlock()).valueOf(), "64000");
    });

    it('pool info', async () => {
        const paiUni = await PaiUni.new(this.pai.address, this.uniToken.address, bob, carol, "50", "0", { from: alice });
        const lpToken = await MockERC20.new("UniSwap LP Token", "LPT", "1000000000", { from: alice });
        const uniStake = await StakingRewards.new(alice, this.uniToken.address, lpToken.address, { from: alice });

        await expectRevert(paiUni.add('1', lpToken.address, uniStake.address, false, { from: bob }), 'Ownable: caller is not the owner');
        await paiUni.add('1', lpToken.address, uniStake.address, false, { from: alice });
        await expectRevert(paiUni.add('1', lpToken.address, uniStake.address, false, { from: alice }), 'lpToken exist');
        assert.equal((await paiUni.poolLength()).valueOf(), '1');
        assert.equal((await paiUni.poolInfo('0')).allocPoint, '1');

        await expectRevert(paiUni.set('0', '10', false, { from: bob }), 'Ownable: caller is not the owner');
        await paiUni.set('0', '10', false);
        assert.equal((await paiUni.poolInfo('0')).allocPoint, '10');
    });

    it('getMultiplier', async () => {
        const paiUni = await PaiUni.new(this.pai.address, this.uniToken.address, bob, carol, "50", "0", { from: alice });
        assert.equal((await paiUni.getMultiplier(0, 64000)).valueOf(), '128000');
        assert.equal((await paiUni.getMultiplier(32000, 70000)).valueOf(), '70000');
        assert.equal((await paiUni.getMultiplier(32000, 130000)).valueOf(), '128000');
        assert.equal((await paiUni.getMultiplier(64000, 128000)).valueOf(), '64000');
        assert.equal((await paiUni.getMultiplier(64000, 130000)).valueOf(), '64000');
        assert.equal((await paiUni.getMultiplier(128000, 130000)).valueOf(), '0');
    });

    context('With ERC/LP token added to the field', () => {
        beforeEach(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
            await this.lp2.transfer(alice, '1000', { from: minter });
            await this.lp2.transfer(bob, '1000', { from: minter });
            await this.lp2.transfer(carol, '1000', { from: minter });

            this.uniStake = await StakingRewards.new(alice, this.uniToken.address, this.lp.address);
            await this.uniToken.transfer(this.uniStake.address, '5000000000000000000000000');
            await this.uniStake.notifyRewardAmount('5000000000000000000000000');
            this.uniStake2 = await StakingRewards.new(alice, this.uniToken.address, this.lp2.address);
            await this.uniToken.transfer(this.uniStake2.address, '5000000000000000000000000');
            await this.uniStake2.notifyRewardAmount('5000000000000000000000000');
        });

        it('should allow emergency withdraw', async () => {
            const paiUni = await PaiUni.new(this.pai.address, this.uniToken.address, bob, carol, "50", "0", { from: alice });
            const minWithdrawInterval = await paiUni.MIN_WITHDRAW_INTERVAL();
            await paiUni.add('1000', this.lp.address, this.uniStake.address, false);
            await this.lp.approve(paiUni.address, '1000', { from: bob });
            await paiUni.deposit(0, '100', { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '900');
            await paiUni.emergencyWithdraw(0, { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '999');
            const withoutFeeBlock = (await time.latestBlock()).add(minWithdrawInterval);
            await time.advanceBlockTo(withoutFeeBlock);
            await paiUni.deposit(0, '100', { from: bob });
            await paiUni.emergencyWithdraw(0, { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '999');
        });

        it('should give out PAIs only after farming time', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            const paiUni = await PaiUni.new(this.pai.address, this.uniToken.address, bob, carol, "50", "100", { from: alice });
            await paiUni.add('100', this.lp.address, this.uniStake.address, false);
            await this.lp.approve(paiUni.address, '1000', { from: bob });
            await paiUni.deposit(0, '100', { from: bob });
            await time.advanceBlockTo('89');
            await paiUni.deposit(0, '0', { from: bob }); // block 90
            assert.equal((await this.pai.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('94');
            await paiUni.deposit(0, '0', { from: bob }); // block 95
            assert.equal((await this.pai.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('99');
            await paiUni.deposit(0, '0', { from: bob }); // block 100
            assert.equal((await this.pai.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('100');
            await expectRevert(paiUni.deposit(0, '0', { from: bob }), 'ERC20: transfer amount exceeds balance'); // block 101
            this.pai.mint(paiUni.address, '100000000000000000000');
            await time.advanceBlockTo('110');
            await paiUni.deposit(0, '0', { from: bob }); // block 111
            assert.equal((await this.pai.balanceOf(bob)).valueOf(), '1100');
            await time.advanceBlockTo('114');
            await paiUni.deposit(0, '0', { from: bob }); // block 115
            assert.equal((await this.pai.balanceOf(bob)).valueOf(), '1500');
        });

        it('should distribute PAIs properly for each staker', async () => {
            // 100 per block farming rate starting at block 300 with bonus until block 1000
           const paiUni = await PaiUni.new(this.pai.address, this.uniToken.address, bob, carol, "50", "300", { from: alice });
            this.pai.mint(paiUni.address, '100000000000000000000');
            await paiUni.add('100', this.lp.address, this.uniStake.address, false);
            await this.lp.approve(paiUni.address, '1000', { from: alice });
            await this.lp.approve(paiUni.address, '1000', { from: bob });
            await this.lp.approve(paiUni.address, '1000', { from: carol });
            // Alice deposits 10 LPs at block 310
            await time.advanceBlockTo('309');
            await paiUni.deposit(0, '10', { from: alice });
            // Bob deposits 20 LPs at block 314
            await time.advanceBlockTo('313');
            await paiUni.deposit(0, '20', { from: bob });
            // Carol deposits 30 LPs at block 318
            await time.advanceBlockTo('317');
            await paiUni.deposit(0, '30', { from: carol });
            await time.advanceBlockTo('319');
            await paiUni.deposit(0, '10', { from: alice });
            assert.equal((await this.pai.balanceOf(alice)).valueOf(), '566');
            assert.equal((await this.pai.balanceOf(bob)).valueOf(), '0');
            assert.equal((await this.pai.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.uniStake.balanceOf(paiUni.address)).valueOf(), '70');
        });

        it('should give proper PAIs allocation to each pool', async () => {
            // 100 per block farming rate starting at block 400 with bonus until block 1000
            const paiUni = await PaiUni.new(this.pai.address, this.uniToken.address, bob, carol, "50", "400", { from: alice });
            this.pai.mint(paiUni.address, '100000000000000000000');
            await this.lp.approve(paiUni.address, '1000', { from: alice });
            await this.lp2.approve(paiUni.address, '1000', { from: bob });
            // Add first LP to the pool with allocation 1
            await paiUni.add('10', this.lp.address, this.uniStake.address, true);
            // Alice deposits 10 LPs at block 410
            await time.advanceBlockTo('409');
            await paiUni.deposit(0, '10', { from: alice });
            // Add LP2 to the pool with allocation 2 at block 420
            await time.advanceBlockTo('419');
            await paiUni.add('20', this.lp2.address, this.uniStake2.address, true);
            // Alice should have 10*100 pending paiReward
            assert.equal((await paiUni.pending(0, alice))[0].valueOf(), '1000');
            // Bob deposits 10 LP2s at block 425
            await time.advanceBlockTo('424');
            await paiUni.deposit(1, '5', { from: bob });
            // Alice should have 1000 + 5*1/3*100 = 583 pending reward
            assert.equal((await paiUni.pending(0, alice))[0].valueOf(), '1166');
            await time.advanceBlockTo('430');
            // At block 430. Bob should get 5*2/3*100 = 166. Alice should get ~83 more.
            assert.equal((await paiUni.pending(0, alice))[0].valueOf(), '1333');
            assert.equal((await paiUni.pending(1, bob))[0].valueOf(), '333');
        });

        // it('earn UNIs', async () => {
        //     const paiUni = await PaiUni.new(this.pai.address, this.uniToken.address, jim, carol, "50", "0", { from: alice });
        //     this.pai.mint(paiUni.address, '100000000000000000000');
        //     const uniRewardRate = await this.uniStake.rewardRate();
        //     console.log(uniRewardRate.toString());
        //     await paiUni.add('10', this.lp.address, this.uniStake.address, true);
        //     await this.lp.approve(paiUni.address, '1000', { from: bob });
        //     await paiUni.deposit(0, '10', { from: bob });
        //     const timestamp = await time.latest();
        //     await time.increase('10');
        //     assert.equal((await paiUni.pending(0, bob))[1].valueOf(), '9645061728395061720');
        //     await paiUni.deposit(0, '0', { from: bob });
        //     assert.equal((await this.uniToken.balanceOf(bob)).valueOf(), '8680555555555555548');
        //     assert.equal((await this.uniToken.balanceOf(jim)).valueOf(), '964506172839506172');
        // })
    })
})