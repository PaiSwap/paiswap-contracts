pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IMigratorChef.sol";
import "./PaiMaster.sol";
import "./interfaces/IPaiRewards.sol";

contract PaiUniV2 is Ownable, ERC20("Wrapped UniSwap Liquidity Token", "WULP") {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 paiRewardDebt; // Pai reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of PAIs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accPaiPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accPaiPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
        uint256 uniRewardDebt; // similar with paiRewardDebt
        uint256 firstDepositTime;
    }

    // Info of each user that stakes LP tokens.
    mapping(address => UserInfo) public userInfo;

    IPaiRewards public uniPai;
    uint256 public lastRewardBlock; // Last block number that PAIs distribution occurs.
    uint256 public accPaiPerShare; // Accumulated PAIs per share, times 1e12. See below.
    uint256 public accUniPerShare; // Accumulated UNIs per share, times 1e12. See below.

    // The UNI Token.
    IERC20 public uniToken;
    // The PAI TOKEN!
    PaiToken public pai;
    PaiMaster public paiMaster;
    IERC20 public lpToken; // Address of LP token contract.

    // The migrator contract. It has a lot of power. Can only be set through governance (owner).
    IMigratorChef public migrator;
    // The address to receive UNI token fee.
    address public uniTokenFeeReceiver;
    // The ratio of UNI token fee (10%).
    uint8 public uniFeeRatio = 10;
    uint8 public isMigrateComplete = 0;

    //Liquidity Event
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    constructor(
        PaiMaster _paiMaster,
        address _uniLpToken,
        address _uniPai,
        address _uniToken,
        PaiToken _pai,
        address _uniTokenFeeReceiver
    ) public {
        paiMaster = _paiMaster;
        uniPai = IPaiRewards(_uniPai);
        uniToken = IERC20(_uniToken);
        pai = _pai;
        uniTokenFeeReceiver = _uniTokenFeeReceiver;
        lpToken = IERC20(_uniLpToken);
    }

    ////////////////////////////////////////////////////////////////////
    //Migrate liquidity to paiswap
    ///////////////////////////////////////////////////////////////////
    function setMigrator(IMigratorChef _migrator) public onlyOwner {
        migrator = _migrator;
    }

    function migrate() public onlyOwner {
        require(address(migrator) != address(0), "migrate: no migrator");
        updatePool();
        //get all lp and uni reward from uniPai
        uniPai.withdraw(totalSupply());
        //get all wrapped lp and pai reward from paiMaster
        uint256 poolIdInPaiMaster = paiMaster.lpTokenPID(address(this)).sub(1);
        paiMaster.withdraw(poolIdInPaiMaster, totalSupply());
        uint256 bal = lpToken.balanceOf(address(this));
        lpToken.safeApprove(address(migrator), bal);
        IERC20 newLpToken = migrator.migrate(lpToken);
        require(bal == newLpToken.balanceOf(address(this)), "migrate: bad");
        lpToken = newLpToken;
        isMigrateComplete = 1;
    }

    // View function to see pending PAIs and UNIs on frontend.
    function pending(address _user) external view returns (uint256 _pai, uint256 _uni) {
        UserInfo storage user = userInfo[_user];
        uint256 tempAccPaiPerShare = accPaiPerShare;
        uint256 tempAccUniPerShare = accUniPerShare;
    
        if (isMigrateComplete == 0 && block.number > lastRewardBlock && totalSupply() != 0) {
            uint256 poolIdInPaiMaster = paiMaster.lpTokenPID(address(this)).sub(1);
            uint256 paiReward = paiMaster.pendingPai(poolIdInPaiMaster, address(this));
            tempAccPaiPerShare = tempAccPaiPerShare.add(paiReward.mul(1e12).div(totalSupply()));
            uint256 uniReward = uniPai.earned(address(this));
            tempAccUniPerShare = tempAccUniPerShare.add(uniReward.mul(1e12).div(totalSupply()));
        }
        _pai = user.amount.mul(tempAccPaiPerShare).div(1e12).sub(user.paiRewardDebt);
        _uni = user.amount.mul(tempAccUniPerShare).div(1e12).sub(user.uniRewardDebt);
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool() public {
        if (block.number <= lastRewardBlock || isMigrateComplete == 1) {
            return;
        }

        if (totalSupply() == 0) {
            lastRewardBlock = block.number;
            return;
        }
        uint256 paiBalance = pai.balanceOf(address(this));
        uint256 poolIdInPaiMaster = paiMaster.lpTokenPID(address(this)).sub(1);
        // Get Pai Reward from PaiMaster
        paiMaster.deposit(poolIdInPaiMaster, 0);
        uint256 paiReward = pai.balanceOf(address(this)).sub(paiBalance);
        accPaiPerShare = accPaiPerShare.add(paiReward.mul(1e12).div((totalSupply())));
        uint256 uniReward = uniPai.earned(address(this));
        uniPai.getReward();
        accUniPerShare = accUniPerShare.add(uniReward.mul(1e12).div(totalSupply()));
        lastRewardBlock = block.number;
    }

    function _mintWulp(address _addr, uint256 _amount) internal {
        lpToken.safeTransferFrom(_addr, address(this), _amount);
        _mint(address(this), _amount);
    }

    function _burnWulp(address _to, uint256 _amount) internal {
        lpToken.safeTransfer(address(_to), _amount);
        _burn(address(this), _amount);
    }

    // Deposit LP tokens to PaiMaster for PAI allocation.
    function deposit(uint256 _amount) public {
        require(isMigrateComplete == 0 || (isMigrateComplete == 1 && _amount == 0), "already migrate");
        UserInfo storage user = userInfo[msg.sender];
        updatePool();
        if (_amount > 0 && user.firstDepositTime == 0) user.firstDepositTime = block.number;
        uint256 pendingPai = user.amount.mul(accPaiPerShare).div(1e12).sub(user.paiRewardDebt);
        uint256 pendingUni = user.amount.mul(accUniPerShare).div(1e12).sub(user.uniRewardDebt);
        user.amount = user.amount.add(_amount);
        user.paiRewardDebt = user.amount.mul(accPaiPerShare).div(1e12);
        user.uniRewardDebt = user.amount.mul(accUniPerShare).div(1e12);
        if (pendingPai > 0) _safePaiTransfer(msg.sender, pendingPai);
        if (pendingUni > 0) {
            uint256 uniFee = pendingUni.mul(uniFeeRatio).div(100);
            uint256 uniToUser = pendingUni.sub(uniFee);
            _safeUniTransfer(uniTokenFeeReceiver, uniFee);
            _safeUniTransfer(msg.sender, uniToUser);
        }
        if (_amount > 0) {
            //generate wrapped uniswap lp token
            _mintWulp(msg.sender, _amount);

            //approve and stake to uniswap
            lpToken.approve(address(uniPai), _amount);
            uniPai.stake(_amount);

            //approve and stake to paimaster
            _approve(address(this), address(paiMaster), _amount);
            uint256 poolIdInPaiMaster = paiMaster.lpTokenPID(address(this)).sub(1);
            paiMaster.deposit(poolIdInPaiMaster, _amount);
        }

        emit Deposit(msg.sender, _amount);
    }

    // Withdraw LP tokens from PaiUni.
    function withdraw(uint256 _amount) public {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool();
        uint256 pendingPai = user.amount.mul(accPaiPerShare).div(1e12).sub(user.paiRewardDebt);
        uint256 pendingUni = user.amount.mul(accUniPerShare).div(1e12).sub(user.uniRewardDebt);
        user.amount = user.amount.sub(_amount);
        user.paiRewardDebt = user.amount.mul(accPaiPerShare).div(1e12);
        user.uniRewardDebt = user.amount.mul(accUniPerShare).div(1e12);
        if (pendingPai > 0) _safePaiTransfer(msg.sender, pendingPai);
        if (pendingUni > 0) {
            uint256 uniFee = pendingUni.mul(uniFeeRatio).div(100);
            uint256 uniToUser = pendingUni.sub(uniFee);
            _safeUniTransfer(uniTokenFeeReceiver, uniFee);
            _safeUniTransfer(msg.sender, uniToUser);
        }
        if (_amount > 0) {
            if (isMigrateComplete == 0) {
                uint256 poolIdInPaiMaster = paiMaster.lpTokenPID(address(this)).sub(1);
                //unstake wrapped lp token from pai master
                paiMaster.withdraw(poolIdInPaiMaster, _amount);
                //unstake uniswap lp token from uniswap
                uniPai.withdraw(_amount);
            }

            _burnWulp(address(msg.sender), _amount);
        }

        emit Withdraw(msg.sender, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() public {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount > 0, "emergencyWithdraw: not good");
        uint256 _amount = user.amount;
        user.amount = 0;
        user.paiRewardDebt = 0;
        user.uniRewardDebt = 0;
        {
            if (isMigrateComplete == 0) {
                uint256 poolIdInPaiMaster = paiMaster.lpTokenPID(address(this)).sub(1);
                //unstake wrapped lp token from pai master
                paiMaster.withdraw(poolIdInPaiMaster, _amount);
                //unstake lp token from uniswap
                uniPai.withdraw(_amount);
            }

            _burnWulp(address(msg.sender), _amount);
        }
        emit EmergencyWithdraw(msg.sender, _amount);
    }

    // Safe pai transfer function, just in case if rounding error causes pool to not have enough PAIs.
    function _safePaiTransfer(address _to, uint256 _amount) internal {
        uint256 paiBal = pai.balanceOf(address(this));
        if (_amount > paiBal) {
            pai.transfer(_to, paiBal);
        } else {
            pai.transfer(_to, _amount);
        }
    }

    // Safe uni transfer function
    function _safeUniTransfer(address _to, uint256 _amount) internal {
        uint256 uniBal = uniToken.balanceOf(address(this));
        if (_amount > uniBal) {
            uniToken.transfer(_to, uniBal);
        } else {
            uniToken.transfer(_to, _amount);
        }
    }

    function setUniTokenFeeReceiver(address _uniTokenFeeReceiver) public onlyOwner {
        uniTokenFeeReceiver = _uniTokenFeeReceiver;
    }
}
