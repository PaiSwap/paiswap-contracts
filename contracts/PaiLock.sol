pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PaiToken.sol";
import "./PaiMaster.sol";

contract PaiLock is ERC20("PaiLockToken", "PaiLock"), Ownable {
    using SafeMath for uint256;
    using Address for address;

    PaiToken public pai;
    PaiMaster public paiMaster;
    address public withDrawAddr;

    constructor(PaiToken _pai, PaiMaster _paiMaster) public {
        require(address(_pai) != address(0) && address(_paiMaster) != address(0), "invalid address");
        pai = _pai;
        paiMaster = _paiMaster;
        _mint(address(this), 1);
    }

    function deposit(uint256 _pid) public onlyOwner {
        _approve(address(this), address(paiMaster), 1);
        paiMaster.deposit(_pid, 1);
    }

    function withdrawFromPaiMaster(uint256 _pid) public {
        paiMaster.deposit(_pid, 0);
    }

    function withdrawToContract(uint256 _amount) public onlyOwner {
        require(withDrawAddr != address(0), "invalid address");
        uint256 totalAmount = pai.balanceOf(address(this));
        require(_amount > 0 && _amount <= totalAmount, "invalid amount");
        pai.transfer(withDrawAddr, _amount);
    }

    function setwithdrawContractAddr(address _withDrawaddr) public onlyOwner {
        withDrawAddr = _withDrawaddr;
    }
}
