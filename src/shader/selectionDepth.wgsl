@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;
@group(0) @binding(4) var<storage, read_write> rods: array<Object>;
@group(0) @binding(5) var<storage, read_write> out: array<i32, 4>;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  if i >= global.rodCount {return;}

  if global.justSetNextBallPosition == 0 {

    // check if this rod was hit first
    if rods[i].prop3 == out[0] {

      // rods[i].color = vec4f(1,0,1,1);

      out[1] = i32(i);

      // possible new ball
      balls[global.nextBallInPool].position = rods[i].position;
    }
  }
  else {

    // check if this rod will get the next ball
    if i == global.newBallRodIndex {
      balls[global.nextBallInPool].position = rods[i].position;
    }
  }

}