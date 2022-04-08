%lang starknet

# @author StarkDefi
# @license MIT
# @description library for StarkDefi contracts

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.math import assert_not_equal, assert_not_zero
from starkware.cairo.common.math_cmp import is_le_felt

namespace StarkDefiLib:
    # Sort tokens by their address
    func sort_tokens{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
        tokenA : felt, tokenB : felt
    ) -> (token0 : felt, token1 : felt):
        alloc_locals
        local token0
        local token1
        assert_not_equal(tokenA, tokenB)
        let (is_tokenA_less) = is_le_felt(tokenA, tokenB)
        if is_tokenA_less == 1:
            assert token0 = tokenA
            assert token1 = tokenB
        else:
            assert token0 = tokenB
            assert token1 = tokenA
        end
        assert_not_zero(token0)
        return (token0, token1)
    end
end
