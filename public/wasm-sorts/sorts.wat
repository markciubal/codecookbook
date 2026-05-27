(module
 (type $0 (func (param i32 i32 i32)))
 (type $1 (func (param i32 i32)))
 (type $2 (func (param i32 i32 i32 i32)))
 (type $3 (func (param i32 i32 i32 i32 i32 i32)))
 (memory $0 0)
 (export "insertionSortI32" (func $wasm-sorts/assembly/index/insertionSortI32))
 (export "quickSortI32" (func $wasm-sorts/assembly/index/quickSortI32))
 (export "logosSortI32" (func $wasm-sorts/assembly/index/logosSortI32))
 (export "memory" (memory $0))
 (func $wasm-sorts/assembly/index/insertionSortI32 (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $1
  i32.const 1
  i32.le_s
  if
   return
  end
  local.get $1
  i32.const 1
  i32.sub
  local.set $4
  i32.const 1
  local.set $2
  loop $for-loop|0
   local.get $2
   local.get $4
   i32.le_s
   if
    local.get $0
    local.get $2
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.set $3
    local.get $2
    i32.const 1
    i32.sub
    local.set $1
    loop $while-continue|1
     local.get $1
     i32.const 0
     i32.ge_s
     if
      local.get $3
      local.get $0
      local.get $1
      i32.const 2
      i32.shl
      i32.add
      i32.load
      local.tee $5
      i32.lt_s
      if
       local.get $0
       local.get $1
       i32.const 1
       i32.add
       i32.const 2
       i32.shl
       i32.add
       local.get $5
       i32.store
       local.get $1
       i32.const 1
       i32.sub
       local.set $1
       br $while-continue|1
      end
     end
    end
    local.get $0
    local.get $1
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.get $3
    i32.store
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $for-loop|0
   end
  end
 )
 (func $wasm-sorts/assembly/index/quickRange (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  loop $while-continue|0
   local.get $2
   local.get $1
   i32.sub
   i32.const 16
   i32.gt_s
   if
    local.get $0
    local.get $1
    i32.const 2
    i32.shl
    i32.add
    local.tee $3
    i32.load
    local.get $0
    local.get $1
    local.get $2
    i32.add
    i32.const 1
    i32.shr_s
    local.tee $4
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    i32.load
    i32.gt_s
    if
     local.get $3
     i32.load
     local.set $6
     local.get $3
     local.get $5
     i32.load
     i32.store
     local.get $5
     local.get $6
     i32.store
    end
    local.get $0
    local.get $1
    i32.const 2
    i32.shl
    i32.add
    local.tee $3
    i32.load
    local.get $0
    local.get $2
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    i32.load
    i32.gt_s
    if
     local.get $3
     i32.load
     local.set $6
     local.get $3
     local.get $5
     i32.load
     i32.store
     local.get $5
     local.get $6
     i32.store
    end
    local.get $0
    local.get $4
    i32.const 2
    i32.shl
    i32.add
    local.tee $3
    i32.load
    local.get $0
    local.get $2
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    i32.load
    i32.gt_s
    if
     local.get $3
     i32.load
     local.set $6
     local.get $3
     local.get $5
     i32.load
     i32.store
     local.get $5
     local.get $6
     i32.store
    end
    local.get $0
    local.get $4
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.set $5
    local.get $1
    i32.const 1
    i32.sub
    local.set $4
    local.get $2
    i32.const 1
    i32.add
    local.set $3
    loop $while-continue|1
     loop $do-loop|2
      local.get $0
      local.get $4
      i32.const 1
      i32.add
      local.tee $4
      i32.const 2
      i32.shl
      i32.add
      i32.load
      local.get $5
      i32.lt_s
      br_if $do-loop|2
     end
     loop $do-loop|3
      local.get $0
      local.get $3
      i32.const 1
      i32.sub
      local.tee $3
      i32.const 2
      i32.shl
      i32.add
      local.tee $6
      i32.load
      local.get $5
      i32.gt_s
      br_if $do-loop|3
     end
     local.get $3
     local.get $4
     i32.gt_s
     if
      local.get $0
      local.get $4
      i32.const 2
      i32.shl
      i32.add
      local.tee $7
      i32.load
      local.set $8
      local.get $7
      local.get $6
      i32.load
      i32.store
      local.get $6
      local.get $8
      i32.store
      br $while-continue|1
     end
    end
    local.get $2
    local.get $3
    i32.sub
    i32.const 1
    i32.sub
    local.get $3
    local.get $1
    i32.sub
    i32.gt_s
    if
     local.get $0
     local.get $1
     local.get $3
     call $wasm-sorts/assembly/index/quickRange
     local.get $3
     i32.const 1
     i32.add
     local.set $1
    else
     local.get $0
     local.get $3
     i32.const 1
     i32.add
     local.get $2
     call $wasm-sorts/assembly/index/quickRange
     local.get $3
     local.set $2
    end
    br $while-continue|0
   end
  end
  local.get $1
  i32.const 1
  i32.add
  local.set $3
  loop $for-loop|0
   local.get $2
   local.get $3
   i32.ge_s
   if
    local.get $0
    local.get $3
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.set $5
    local.get $3
    i32.const 1
    i32.sub
    local.set $4
    loop $while-continue|10
     local.get $1
     local.get $4
     i32.le_s
     if
      local.get $5
      local.get $0
      local.get $4
      i32.const 2
      i32.shl
      i32.add
      i32.load
      local.tee $6
      i32.lt_s
      if
       local.get $0
       local.get $4
       i32.const 1
       i32.add
       i32.const 2
       i32.shl
       i32.add
       local.get $6
       i32.store
       local.get $4
       i32.const 1
       i32.sub
       local.set $4
       br $while-continue|10
      end
     end
    end
    local.get $0
    local.get $4
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.get $5
    i32.store
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|0
   end
  end
 )
 (func $wasm-sorts/assembly/index/quickSortI32 (param $0 i32) (param $1 i32)
  local.get $1
  i32.const 1
  i32.gt_s
  if
   local.get $0
   i32.const 0
   local.get $1
   i32.const 1
   i32.sub
   call $wasm-sorts/assembly/index/quickRange
  end
 )
 (func $wasm-sorts/assembly/index/logosRadixI32 (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  local.get $2
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.set $8
  loop $for-loop|0
   local.get $5
   i32.const 1028
   i32.lt_s
   if
    local.get $8
    local.get $5
    i32.const 2
    i32.shl
    i32.add
    i32.const 0
    i32.store
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
  local.get $8
  i32.const 1028
  i32.add
  local.set $9
  local.get $8
  i32.const 2056
  i32.add
  local.set $6
  local.get $8
  i32.const 3084
  i32.add
  local.set $7
  loop $for-loop|1
   local.get $1
   local.get $4
   i32.gt_s
   if
    local.get $0
    local.get $4
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    i32.load
    i32.const -2147483648
    i32.xor
    local.set $10
    local.get $5
    local.get $10
    i32.store
    local.get $8
    local.get $10
    i32.const 255
    i32.and
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    local.get $5
    i32.load
    i32.const 1
    i32.add
    i32.store
    local.get $9
    local.get $10
    i32.const 8
    i32.shr_u
    i32.const 255
    i32.and
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    local.get $5
    i32.load
    i32.const 1
    i32.add
    i32.store
    local.get $6
    local.get $10
    i32.const 16
    i32.shr_u
    i32.const 255
    i32.and
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    local.get $5
    i32.load
    i32.const 1
    i32.add
    i32.store
    local.get $7
    local.get $10
    i32.const 24
    i32.shr_u
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    local.get $5
    i32.load
    i32.const 1
    i32.add
    i32.store
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $for-loop|1
   end
  end
  i32.const 1
  local.set $5
  loop $for-loop|2
   local.get $5
   i32.const 257
   i32.lt_s
   if
    local.get $5
    i32.const 2
    i32.shl
    local.tee $4
    local.get $8
    i32.add
    local.tee $10
    local.get $10
    i32.load
    local.get $5
    i32.const 1
    i32.sub
    i32.const 2
    i32.shl
    local.tee $10
    local.get $8
    i32.add
    i32.load
    i32.add
    i32.store
    local.get $4
    local.get $9
    i32.add
    local.tee $11
    local.get $11
    i32.load
    local.get $9
    local.get $10
    i32.add
    i32.load
    i32.add
    i32.store
    local.get $4
    local.get $6
    i32.add
    local.tee $11
    local.get $11
    i32.load
    local.get $6
    local.get $10
    i32.add
    i32.load
    i32.add
    i32.store
    local.get $4
    local.get $7
    i32.add
    local.tee $4
    local.get $4
    i32.load
    local.get $7
    local.get $10
    i32.add
    i32.load
    i32.add
    i32.store
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|2
   end
  end
  i32.const 0
  local.set $4
  loop $for-loop|3
   local.get $1
   local.get $4
   i32.gt_s
   if
    local.get $8
    local.get $0
    local.get $4
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.tee $5
    i32.const 255
    i32.and
    i32.const 2
    i32.shl
    i32.add
    local.tee $10
    i32.load
    local.set $11
    local.get $10
    local.get $11
    i32.const 1
    i32.add
    i32.store
    local.get $2
    local.get $11
    i32.const 2
    i32.shl
    i32.add
    local.get $5
    i32.store
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $for-loop|3
   end
  end
  loop $for-loop|4
   local.get $1
   local.get $3
   i32.gt_s
   if
    local.get $9
    local.get $2
    local.get $3
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.tee $4
    i32.const 8
    i32.shr_u
    i32.const 255
    i32.and
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    i32.load
    local.set $8
    local.get $5
    local.get $8
    i32.const 1
    i32.add
    i32.store
    local.get $0
    local.get $8
    i32.const 2
    i32.shl
    i32.add
    local.get $4
    i32.store
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|4
   end
  end
  i32.const 0
  local.set $3
  loop $for-loop|5
   local.get $1
   local.get $3
   i32.gt_s
   if
    local.get $6
    local.get $0
    local.get $3
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.tee $4
    i32.const 16
    i32.shr_u
    i32.const 255
    i32.and
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    i32.load
    local.set $8
    local.get $5
    local.get $8
    i32.const 1
    i32.add
    i32.store
    local.get $2
    local.get $8
    i32.const 2
    i32.shl
    i32.add
    local.get $4
    i32.store
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|5
   end
  end
  i32.const 0
  local.set $3
  loop $for-loop|6
   local.get $1
   local.get $3
   i32.gt_s
   if
    local.get $7
    local.get $2
    local.get $3
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.tee $4
    i32.const 24
    i32.shr_u
    i32.const 2
    i32.shl
    i32.add
    local.tee $5
    i32.load
    local.set $6
    local.get $5
    local.get $6
    i32.const 1
    i32.add
    i32.store
    local.get $0
    local.get $6
    i32.const 2
    i32.shl
    i32.add
    local.get $4
    i32.store
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|6
   end
  end
  i32.const 0
  local.set $2
  loop $for-loop|7
   local.get $1
   local.get $2
   i32.gt_s
   if
    local.get $0
    local.get $2
    i32.const 2
    i32.shl
    i32.add
    local.tee $3
    local.get $3
    i32.load
    i32.const -2147483648
    i32.xor
    i32.store
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $for-loop|7
   end
  end
 )
 (func $wasm-sorts/assembly/index/logosSiftDown (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32)
  (local $4 i32)
  (local $5 i32)
  loop $while-continue|0
   local.get $2
   local.tee $4
   i32.const 1
   i32.shl
   i32.const 1
   i32.add
   local.tee $2
   i32.const 1
   i32.add
   local.set $5
   local.get $4
   local.get $5
   local.get $2
   local.get $4
   local.get $2
   local.get $3
   i32.lt_s
   if (result i32)
    local.get $0
    local.get $1
    local.get $2
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.get $0
    local.get $1
    local.get $4
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load
    i32.gt_s
   else
    i32.const 0
   end
   select
   local.tee $2
   local.get $3
   local.get $5
   i32.gt_s
   if (result i32)
    local.get $0
    local.get $1
    local.get $5
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.get $0
    local.get $1
    local.get $2
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load
    i32.gt_s
   else
    i32.const 0
   end
   select
   local.tee $2
   i32.ne
   if
    local.get $0
    local.get $1
    local.get $4
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.tee $4
    i32.load
    local.set $5
    local.get $4
    local.get $0
    local.get $1
    local.get $2
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.tee $4
    i32.load
    i32.store
    local.get $4
    local.get $5
    i32.store
    br $while-continue|0
   end
  end
 )
 (func $wasm-sorts/assembly/index/logosSort5 (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  local.tee $6
  i32.load
  local.tee $7
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.tee $8
  i32.load
  local.tee $9
  i32.lt_s
  if
   local.get $8
   local.get $7
   i32.store
   local.get $6
   local.get $9
   i32.store
  end
  local.get $0
  local.get $3
  i32.const 2
  i32.shl
  i32.add
  local.tee $6
  i32.load
  local.tee $7
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  local.tee $8
  i32.load
  local.tee $9
  i32.lt_s
  if
   local.get $8
   local.get $7
   i32.store
   local.get $6
   local.get $9
   i32.store
  end
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  local.tee $6
  i32.load
  local.tee $7
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.tee $8
  i32.load
  local.tee $9
  i32.lt_s
  if
   local.get $8
   local.get $7
   i32.store
   local.get $6
   local.get $9
   i32.store
  end
  local.get $0
  local.get $4
  i32.const 2
  i32.shl
  i32.add
  local.tee $6
  i32.load
  local.tee $7
  local.get $0
  local.get $3
  i32.const 2
  i32.shl
  i32.add
  local.tee $8
  i32.load
  local.tee $9
  i32.lt_s
  if
   local.get $8
   local.get $7
   i32.store
   local.get $6
   local.get $9
   i32.store
  end
  local.get $0
  local.get $3
  i32.const 2
  i32.shl
  i32.add
  local.tee $6
  i32.load
  local.tee $7
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  local.tee $8
  i32.load
  local.tee $9
  i32.lt_s
  if
   local.get $8
   local.get $7
   i32.store
   local.get $6
   local.get $9
   i32.store
  end
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  local.tee $6
  i32.load
  local.tee $7
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.tee $8
  i32.load
  local.tee $9
  i32.lt_s
  if
   local.get $8
   local.get $7
   i32.store
   local.get $6
   local.get $9
   i32.store
  end
  local.get $0
  local.get $5
  i32.const 2
  i32.shl
  i32.add
  local.tee $5
  i32.load
  local.tee $6
  local.get $0
  local.get $4
  i32.const 2
  i32.shl
  i32.add
  local.tee $7
  i32.load
  local.tee $8
  i32.lt_s
  if
   local.get $7
   local.get $6
   i32.store
   local.get $5
   local.get $8
   i32.store
  end
  local.get $0
  local.get $4
  i32.const 2
  i32.shl
  i32.add
  local.tee $4
  i32.load
  local.tee $5
  local.get $0
  local.get $3
  i32.const 2
  i32.shl
  i32.add
  local.tee $6
  i32.load
  local.tee $7
  i32.lt_s
  if
   local.get $6
   local.get $5
   i32.store
   local.get $4
   local.get $7
   i32.store
  end
  local.get $0
  local.get $3
  i32.const 2
  i32.shl
  i32.add
  local.tee $3
  i32.load
  local.tee $4
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  local.tee $5
  i32.load
  local.tee $6
  i32.lt_s
  if
   local.get $5
   local.get $4
   i32.store
   local.get $3
   local.get $6
   i32.store
  end
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  local.tee $2
  i32.load
  local.tee $3
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  i32.load
  local.tee $1
  i32.lt_s
  if
   local.get $0
   local.get $3
   i32.store
   local.get $2
   local.get $1
   i32.store
  end
 )
 (func $wasm-sorts/assembly/index/logosQuick (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  loop $while-continue|0
   local.get $2
   local.get $1
   i32.sub
   local.tee $4
   i32.const 24
   i32.ge_s
   if
    local.get $3
    i32.eqz
    if
     local.get $4
     i32.const 1
     i32.add
     local.tee $3
     i32.const 1
     i32.shr_s
     i32.const 1
     i32.sub
     local.set $2
     loop $for-loop|0
      local.get $2
      i32.const 0
      i32.ge_s
      if
       local.get $0
       local.get $1
       local.get $2
       local.get $3
       call $wasm-sorts/assembly/index/logosSiftDown
       local.get $2
       i32.const 1
       i32.sub
       local.set $2
       br $for-loop|0
      end
     end
     local.get $3
     i32.const 1
     i32.sub
     local.set $2
     loop $for-loop|1
      local.get $2
      i32.const 0
      i32.gt_s
      if
       local.get $0
       local.get $1
       i32.const 2
       i32.shl
       i32.add
       local.tee $3
       i32.load
       local.set $4
       local.get $3
       local.get $0
       local.get $1
       local.get $2
       i32.add
       i32.const 2
       i32.shl
       i32.add
       local.tee $3
       i32.load
       i32.store
       local.get $3
       local.get $4
       i32.store
       local.get $0
       local.get $1
       i32.const 0
       local.get $2
       call $wasm-sorts/assembly/index/logosSiftDown
       local.get $2
       i32.const 1
       i32.sub
       local.set $2
       br $for-loop|1
      end
     end
     return
    end
    local.get $1
    local.get $2
    i32.add
    i32.const 1
    i32.shr_s
    local.tee $4
    local.get $2
    local.get $1
    i32.sub
    i32.const 1
    i32.add
    local.tee $5
    i32.const 3
    i32.shr_s
    local.get $5
    i32.const 6
    i32.shr_s
    i32.add
    i32.const 1
    i32.add
    local.tee $5
    i32.sub
    local.set $6
    local.get $4
    local.get $5
    i32.add
    local.tee $7
    local.get $5
    i32.add
    local.set $8
    local.get $0
    local.get $6
    local.get $5
    i32.sub
    local.tee $5
    local.get $6
    local.get $4
    local.get $7
    local.get $8
    call $wasm-sorts/assembly/index/logosSort5
    local.get $0
    local.get $6
    i32.const 2
    i32.shl
    i32.add
    local.tee $6
    i32.load
    local.tee $9
    local.get $0
    local.get $4
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.tee $10
    i32.ne
    local.get $9
    local.get $0
    local.get $5
    i32.const 2
    i32.shl
    i32.add
    i32.load
    i32.ne
    i32.and
    local.get $10
    local.get $0
    local.get $7
    i32.const 2
    i32.shl
    i32.add
    local.tee $4
    i32.load
    local.tee $11
    i32.ne
    i32.and
    local.get $0
    local.get $8
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.get $11
    i32.ne
    i32.and
    if
     local.get $6
     local.get $0
     local.get $1
     i32.const 2
     i32.shl
     i32.add
     i32.load
     i32.store
     local.get $4
     local.get $0
     local.get $2
     i32.const 2
     i32.shl
     i32.add
     i32.load
     i32.store
     local.get $2
     i32.const 1
     i32.sub
     local.set $5
     local.get $1
     i32.const 1
     i32.add
     local.tee $4
     local.set $6
     loop $while-continue|1
      local.get $5
      local.get $6
      i32.ge_s
      if
       local.get $0
       local.get $6
       i32.const 2
       i32.shl
       i32.add
       local.tee $7
       i32.load
       local.tee $10
       local.get $9
       i32.lt_s
       if (result i32)
        local.get $7
        local.get $0
        local.get $4
        i32.const 2
        i32.shl
        i32.add
        local.tee $7
        i32.load
        i32.store
        local.get $7
        local.get $10
        i32.store
        local.get $4
        i32.const 1
        i32.add
       else
        local.get $10
        local.get $11
        i32.gt_s
        if (result i32)
         loop $while-continue|2
          local.get $5
          local.get $6
          i32.gt_s
          if (result i32)
           local.get $0
           local.get $5
           i32.const 2
           i32.shl
           i32.add
           i32.load
           local.get $11
           i32.gt_s
          else
           i32.const 0
          end
          if
           local.get $5
           i32.const 1
           i32.sub
           local.set $5
           br $while-continue|2
          end
         end
         local.get $0
         local.get $6
         i32.const 2
         i32.shl
         i32.add
         local.tee $12
         local.get $0
         local.get $5
         i32.const 2
         i32.shl
         i32.add
         local.tee $7
         i32.load
         local.tee $8
         i32.store
         local.get $7
         local.get $10
         i32.store
         local.get $5
         i32.const 1
         i32.sub
         local.set $5
         local.get $8
         local.get $9
         i32.lt_s
         if (result i32)
          local.get $12
          local.get $0
          local.get $4
          i32.const 2
          i32.shl
          i32.add
          local.tee $7
          i32.load
          i32.store
          local.get $7
          local.get $8
          i32.store
          local.get $4
          i32.const 1
          i32.add
         else
          local.get $4
         end
        else
         local.get $4
        end
       end
       local.set $4
       local.get $6
       i32.const 1
       i32.add
       local.set $6
       br $while-continue|1
      end
     end
     local.get $0
     local.get $1
     i32.const 2
     i32.shl
     i32.add
     local.get $0
     local.get $4
     i32.const 1
     i32.sub
     i32.const 2
     i32.shl
     i32.add
     local.tee $6
     i32.load
     i32.store
     local.get $6
     local.get $9
     i32.store
     local.get $0
     local.get $2
     i32.const 2
     i32.shl
     i32.add
     local.get $0
     local.get $5
     i32.const 1
     i32.add
     i32.const 2
     i32.shl
     i32.add
     local.tee $6
     i32.load
     i32.store
     local.get $6
     local.get $11
     i32.store
     local.get $0
     local.get $1
     local.get $4
     i32.const 2
     i32.sub
     local.get $3
     i32.const 1
     i32.sub
     local.tee $3
     call $wasm-sorts/assembly/index/logosQuick
     local.get $0
     local.get $5
     i32.const 2
     i32.add
     local.get $2
     local.get $3
     call $wasm-sorts/assembly/index/logosQuick
     local.get $9
     local.get $11
     i32.eq
     if
      return
     end
     local.get $4
     local.set $1
     local.get $5
     local.set $2
     loop $while-continue|3
      local.get $1
      local.get $2
      i32.le_s
      if (result i32)
       local.get $0
       local.get $1
       i32.const 2
       i32.shl
       i32.add
       i32.load
       local.get $9
       i32.eq
      else
       i32.const 0
      end
      if
       local.get $1
       i32.const 1
       i32.add
       local.set $1
       br $while-continue|3
      end
     end
     loop $while-continue|4
      local.get $1
      local.get $2
      i32.le_s
      if (result i32)
       local.get $0
       local.get $2
       i32.const 2
       i32.shl
       i32.add
       i32.load
       local.get $11
       i32.eq
      else
       i32.const 0
      end
      if
       local.get $2
       i32.const 1
       i32.sub
       local.set $2
       br $while-continue|4
      end
     end
    else
     local.get $2
     local.set $4
     local.get $1
     local.tee $6
     local.set $5
     loop $while-continue|5
      local.get $4
      local.get $5
      i32.ge_s
      if
       local.get $10
       local.get $0
       local.get $5
       i32.const 2
       i32.shl
       i32.add
       local.tee $7
       i32.load
       local.tee $8
       i32.gt_s
       if
        local.get $7
        local.get $0
        local.get $6
        i32.const 2
        i32.shl
        i32.add
        local.tee $7
        i32.load
        i32.store
        local.get $7
        local.get $8
        i32.store
        local.get $6
        i32.const 1
        i32.add
        local.set $6
        local.get $5
        i32.const 1
        i32.add
        local.set $5
       else
        local.get $8
        local.get $10
        i32.gt_s
        if
         local.get $0
         local.get $5
         i32.const 2
         i32.shl
         i32.add
         local.get $0
         local.get $4
         i32.const 2
         i32.shl
         i32.add
         local.tee $7
         i32.load
         i32.store
         local.get $7
         local.get $8
         i32.store
         local.get $4
         i32.const 1
         i32.sub
         local.set $4
        else
         local.get $5
         i32.const 1
         i32.add
         local.set $5
        end
       end
       br $while-continue|5
      end
     end
     local.get $3
     i32.const 1
     i32.sub
     local.set $3
     local.get $6
     local.get $1
     i32.sub
     local.get $2
     local.get $4
     i32.sub
     i32.lt_s
     if
      local.get $0
      local.get $1
      local.get $6
      i32.const 1
      i32.sub
      local.get $3
      call $wasm-sorts/assembly/index/logosQuick
      local.get $4
      i32.const 1
      i32.add
      local.set $1
     else
      local.get $0
      local.get $4
      i32.const 1
      i32.add
      local.get $2
      local.get $3
      call $wasm-sorts/assembly/index/logosQuick
      local.get $6
      i32.const 1
      i32.sub
      local.set $2
     end
    end
    br $while-continue|0
   end
  end
  local.get $1
  i32.const 1
  i32.add
  local.set $5
  loop $for-loop|00
   local.get $2
   local.get $5
   i32.ge_s
   if
    local.get $0
    local.get $5
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.set $3
    local.get $5
    i32.const 1
    i32.sub
    local.set $6
    loop $while-continue|11
     local.get $1
     local.get $6
     i32.le_s
     if
      local.get $3
      local.get $0
      local.get $6
      i32.const 2
      i32.shl
      i32.add
      i32.load
      local.tee $4
      i32.lt_s
      if
       local.get $0
       local.get $6
       i32.const 1
       i32.add
       i32.const 2
       i32.shl
       i32.add
       local.get $4
       i32.store
       local.get $6
       i32.const 1
       i32.sub
       local.set $6
       br $while-continue|11
      end
     end
    end
    local.get $0
    local.get $6
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.get $3
    i32.store
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|00
   end
  end
 )
 (func $wasm-sorts/assembly/index/logosSortI32 (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  local.get $1
  i32.const 2
  i32.lt_s
  if
   return
  end
  i32.const 1
  local.set $3
  i32.const 1
  local.set $5
  i32.const 1
  local.set $4
  loop $for-loop|0
   local.get $1
   local.get $4
   i32.gt_s
   if
    i32.const 0
    local.get $3
    local.get $0
    local.get $4
    i32.const 1
    i32.sub
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.tee $6
    local.get $0
    local.get $4
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.tee $7
    i32.gt_s
    local.get $3
    i32.and
    select
    local.tee $3
    i32.const 0
    local.get $5
    local.get $6
    local.get $7
    i32.lt_s
    local.get $5
    i32.and
    select
    local.tee $5
    i32.or
    if
     local.get $4
     i32.const 1
     i32.add
     local.set $4
     br $for-loop|0
    end
   end
  end
  local.get $3
  if
   return
  end
  local.get $5
  if
   i32.const 0
   local.set $2
   local.get $1
   i32.const 1
   i32.sub
   local.set $1
   loop $while-continue|1
    local.get $1
    local.get $2
    i32.gt_s
    if
     local.get $0
     local.get $2
     i32.const 2
     i32.shl
     i32.add
     local.tee $3
     i32.load
     local.set $4
     local.get $3
     local.get $0
     local.get $1
     i32.const 2
     i32.shl
     i32.add
     local.tee $3
     i32.load
     i32.store
     local.get $3
     local.get $4
     i32.store
     local.get $2
     i32.const 1
     i32.add
     local.set $2
     local.get $1
     i32.const 1
     i32.sub
     local.set $1
     br $while-continue|1
    end
   end
   return
  end
  local.get $1
  i32.const 24
  i32.le_s
  if
   local.get $1
   i32.const 1
   i32.sub
   local.set $3
   i32.const 1
   local.set $2
   loop $for-loop|00
    local.get $2
    local.get $3
    i32.le_s
    if
     local.get $0
     local.get $2
     i32.const 2
     i32.shl
     i32.add
     i32.load
     local.set $4
     local.get $2
     i32.const 1
     i32.sub
     local.set $1
     loop $while-continue|11
      local.get $1
      i32.const 0
      i32.ge_s
      if
       local.get $4
       local.get $0
       local.get $1
       i32.const 2
       i32.shl
       i32.add
       i32.load
       local.tee $5
       i32.lt_s
       if
        local.get $0
        local.get $1
        i32.const 1
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.get $5
        i32.store
        local.get $1
        i32.const 1
        i32.sub
        local.set $1
        br $while-continue|11
       end
      end
     end
     local.get $0
     local.get $1
     i32.const 1
     i32.add
     i32.const 2
     i32.shl
     i32.add
     local.get $4
     i32.store
     local.get $2
     i32.const 1
     i32.add
     local.set $2
     br $for-loop|00
    end
   end
   return
  end
  local.get $1
  i32.const 64
  i32.ge_s
  if
   local.get $0
   local.get $1
   local.get $2
   call $wasm-sorts/assembly/index/logosRadixI32
   return
  end
  local.get $0
  i32.const 0
  local.get $1
  i32.const 1
  i32.sub
  i32.const 31
  local.get $1
  i32.clz
  i32.sub
  i32.const 1
  i32.shl
  call $wasm-sorts/assembly/index/logosQuick
 )
)
