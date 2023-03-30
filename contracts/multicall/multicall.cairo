%lang starknet

from starkware.starknet.common.syscalls import call_contract, get_block_number, get_block_timestamp
from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.memcpy import memcpy

@view
func aggregate{syscall_ptr: felt*, range_check_ptr}(calls_len: felt, calls: felt*) -> (
    block_number: felt, result_len: felt, result: felt*
) {
    alloc_locals;

    let (result: felt*) = alloc();
    let (result_len) = call_loop(calls_len=calls_len, calls=calls, result=result);
    let (block_number) = get_block_number();

    return (block_number=block_number, result_len=result_len, result=result);
}

func call_loop{syscall_ptr: felt*, range_check_ptr}(
    calls_len: felt, calls: felt*, result: felt*
) -> (result_len: felt) {
    if (calls_len == 0) {
        return (0,);
    }
    alloc_locals;

    let response = call_contract(
        contract_address=[calls],
        function_selector=[calls + 1],
        calldata_size=[calls + 2],
        calldata=&[calls + 3],
    );

    memcpy(result, response.retdata, response.retdata_size);

    let (len) = call_loop(
        calls_len=calls_len - (3 + [calls + 2]),
        calls=calls + (3 + [calls + 2]),
        result=result + response.retdata_size,
    );
    return (len + response.retdata_size,);
}

@view
func get_current_block_timestamp{syscall_ptr : felt*, range_check_ptr}() -> (
        block_timestamp : felt) {
    let (block_timestamp) = get_block_timestamp();

    return (block_timestamp=block_timestamp);
}