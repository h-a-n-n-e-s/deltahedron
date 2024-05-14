@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(1) var<storage, read> edges: array<HalfEdge>;
@group(0) @binding(2) var<storage, read_write> velocityUpdate: array<i32>;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  if i >= global.ballCount {return;}

  let dt = global.timeStep;

  let a = balls[i];

  var newBall = a;

  if global.mouseChanged > 0 && raySphereIntersection(global, newBall) > 0{
    if newBall.color.g == 0 {newBall.color = vec4f(1);}
    else {newBall.color = vec4f(1,0,1,1);}
    // newBall.position += global.mouseRay - global.eye;
  }

  // newBall.velocity = vec3f(0);
  // newBall.velocity *= 0.6;

  let up = vec3i(velocityUpdate[3*i], velocityUpdate[3*i+1], velocityUpdate[3*i+2]);
  newBall.velocity = vec3f(up) * DEQUANTIZE_FACTOR;
  velocityUpdate[3*i] = 0;
  velocityUpdate[3*i+1] = 0;
  velocityUpdate[3*i+2] = 0;

  // shapePara1 is the radius of the ball

  for (var j=0u; j<global.ballCount; j++) {
    if i == j {continue;}
    let b = balls[j];
    let ab = a.position - b.position;
    let d = a.shapePara1 + b.shapePara1;
    let lenab = length(ab);

    newBall.velocity += global.gravity * ab / pow(lenab,1);
  }

  newBall.position += newBall.velocity * dt;

  balls[i] = newBall;
}