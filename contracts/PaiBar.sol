pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


contract PaiBar is ERC20("PaiBar", "xPAI"){
    using SafeMath for uint256;
    IERC20 public pai;

    constructor(IERC20 _pai) public {
        require(address(_pai) != address(0), "invalid address");
        pai = _pai;
    }

    // Enter the bar. Pay some PAIs. Earn some shares.
    function enter(uint256 _amount) public {
        uint256 totalPai = pai.balanceOf(address(this));
        uint256 totalShares = totalSupply();
        if (totalShares == 0 || totalPai == 0) {
            _mint(msg.sender, _amount);
        } else {
            uint256 what = _amount.mul(totalShares).div(totalPai);
            _mint(msg.sender, what);
        }
        pai.transferFrom(msg.sender, address(this), _amount);
    }

    // Leave the bar. Claim back your PAIs.
    function leave(uint256 _share) public {
        uint256 totalShares = totalSupply();
        uint256 what = _share.mul(pai.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        pai.transfer(msg.sender, what);
    }
}
