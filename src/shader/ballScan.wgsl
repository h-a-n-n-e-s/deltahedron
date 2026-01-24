@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;
@group(0) @binding(5) var<storage, read_write> out: Out;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  if i >= global.ballCount {return;}

  // check if this ball was hit first
  if balls[i].distanceToCamera == atomicLoad(&out.minDistanceToCamera) {
    atomicStore(&out.closestBallIndex, i32(i));
  }
}
