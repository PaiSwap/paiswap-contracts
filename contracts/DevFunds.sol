pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./PaiToken.sol";

contract DevFunds {
    using SafeMath for uint;

    // the pai token
    PaiToken public pai;
    // dev address to receive pai
    address public devaddr;
    // last withdraw block, use paiswap online block as default
    uint public lastWithdrawBlock = 10821000;
    // withdraw interval ~ 2 weeks
    uint public constant WITHDRAW_INTERVAL = 89600;
    // current total amount bigger than the threshold, withdraw half, otherwise withdraw all
    uint public constant WITHDRAW_HALF_THRESHOLD = 89600*10**18;

    constructor(PaiToken _pai, address _devaddr) public {
        require(address(_pai) != address(0) && _devaddr != address(0), "invalid address");
        pai = _pai;
        devaddr = _devaddr;
    }

    function withdraw() public {
        uint unlockBlock = lastWithdrawBlock.add(WITHDRAW_INTERVAL);
        require(block.number >= unlockBlock, "pai locked");
        uint _amount = pai.balanceOf(address(this));
        require(_amount > 0, "zero pai amount");
        uint amountReal = _amount;
        if (_amount > WITHDRAW_HALF_THRESHOLD) amountReal = _amount.div(2);
        lastWithdrawBlock = block.number;
        pai.transfer(devaddr, amountReal);
    }
}