@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;
@group(0) @binding(5) var<storage, read_write> out: array< atomic<i32> >;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  if i >= global.ballCount {return;}

  // check if this ball was hit first
  if balls[i].distanceToMouse == atomicLoad(&out[0]) {
    atomicStore(&out[1], i32(i));
  }
}
