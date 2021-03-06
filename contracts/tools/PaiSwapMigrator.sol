// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../paiswap/interfaces/IPaiSwapERC20.sol";

interface IRouter {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}

interface IFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

// Migrate from SUSHISWAP/UNISWAP to PAISWAP
contract PaiSwapMigrator {
    IFactory public uniFactory = IFactory(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);
    IRouter public uniRouter = IRouter(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    IFactory public sushiFactory = IFactory(0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac);
    IRouter public sushiRouter = IRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    IRouter public paiRouter = IRouter(0x9C578b573EdE001b95d51a55A3FAfb45f5608b1f);

    // constructor(
    //     address _uniFactory, 
    //     address _uniRouter, 
    //     address _sushiFactory, 
    //     address _sushiRouter, 
    //     address _paiRouter
    // ) public {
    //     uniFactory = IFactory(_uniFactory);
    //     uniRouter = IRouter(_uniRouter);
    //     sushiFactory = IFactory(_sushiFactory);
    //     sushiRouter = IRouter(_sushiRouter);
    //     paiRouter = IRouter(_paiRouter);
    // }

    function migrateUniswapWithPermit(
        address token0,
        address token1,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        address pair = uniFactory.getPair(token0, token1);

        // Permit
        IPaiSwapERC20(pair).permit(
            msg.sender,
            address(this),
            value,
            deadline,
            v,
            r,
            s
        );

        _migrate(uniRouter, IPaiSwapERC20(pair), token0, token1, value);
    }

    function migrateSushiSwapWithPermit(
        address token0,
        address token1,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        address pair = sushiFactory.getPair(token0, token1);

        // Permit
        IPaiSwapERC20(pair).permit(
            msg.sender,
            address(this),
            value,
            deadline,
            v,
            r,
            s
        );

        _migrate(sushiRouter, IPaiSwapERC20(pair), token0, token1, value);
    }

    function migrateUniswap(address token0, address token1, uint256 value) public {
        address pair = uniFactory.getPair(token0, token1);
        _migrate(uniRouter, IPaiSwapERC20(pair), token0, token1, value);
    }

    function migrateSushiSwap(address token0, address token1, uint256 value) public {
        address pair = sushiFactory.getPair(token0, token1);
        _migrate(sushiRouter, IPaiSwapERC20(pair), token0, token1, value);
    }

    function _migrate(IRouter router, IPaiSwapERC20 pair, address token0, address token1, uint256 value) internal {
        // Removes liquidity
        pair.transferFrom(msg.sender, address(this), value);
        pair.approve(address(router), value);
        router.removeLiquidity(
            token0,
            token1,
            value,
            0,
            0,
            address(this),
            now + 60
        );

        // Adds liquidity to PaiSwap
        uint256 bal0 = IPaiSwapERC20(token0).balanceOf(address(this));
        uint256 bal1 = IPaiSwapERC20(token1).balanceOf(address(this));
        IPaiSwapERC20(token0).approve(address(paiRouter), bal0);
        IPaiSwapERC20(token1).approve(address(paiRouter), bal1);
        paiRouter.addLiquidity(
            token0,
            token1,
            bal0,
            bal1,
            0,
            0,
            msg.sender,
            now + 60
        );

        // Refund sender any remaining tokens
        uint256 remainBal0 = IPaiSwapERC20(token0).balanceOf(address(this));
        uint256 remainBal1 = IPaiSwapERC20(token1).balanceOf(address(this));
        if (remainBal0 > 0) IPaiSwapERC20(token0).transfer(msg.sender, remainBal0);
        if (remainBal1 > 0) IPaiSwapERC20(token1).transfer(msg.sender, remainBal1);
    }
}
