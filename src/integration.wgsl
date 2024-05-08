
const repulsion = 5000.0;
const dissipation = 10.0;//100.0;
const cohesion = 20.0;//200.0;

@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(1) var<storage, read> connectionList: array<array<i32,16> >;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  let numberOfBalls = arrayLength(&balls);
  if i >= numberOfBalls {return;}

  let dt = global.timeStep;

  let a = balls[i];
  let connection = connectionList[i];

  var newBall = a;

  var contactCounter = 0u;

  newBall.velocity = vec3f(0);

  // 'size' is equivalent to the radius of the ball

  for (var j=0u; j<numberOfBalls; j++) {
    if i == j {continue;}
    let b = balls[j];
    let ab = a.position - b.position;
    let d = a.size + b.size;
    let lenab = length(ab);

    newBall.velocity += global.gravity * ab / pow(lenab,1);

    // if lenab > d {continue;}
    // else {
    //   let nor = normalize(ab);
    //   let dep = d - lenab; // overlap depth
    //   let r = sqrt(a.size * b.size / (a.size + b.size));
    //   let vab = a.velocity - b.velocity;
    //   let vNor = dot(vab, nor) * nor;

    //   // force update
    //   newBall.velocity += ((repulsion * dep - cohesion * pow(dep, 0.25)) * nor - dissipation * vNor) * sqrt(dep) * r * dt / a.mass;

    //   contactCounter++;
    // }
  }
  // if contactCounter == 0 {newBall.velocity = vec3f(0);} // @@@@@ for non-overlap algorithm

  // deltahedron test
  for (var j=0u; j<16; j++) {
    let k = connection[j];
    if k == -1 {break;}
    let b = balls[k];
    let ab = a.position - b.position;
    let d = 0.8;
    let lenab = length(ab);
    var nor = vec3f(0);
    if lenab > 0.0 {nor = normalize(ab);}
    let def = d - lenab;
    newBall.velocity += def * nor;
  }


  newBall.position += newBall.velocity * dt;

  // wall collisions //////////////////////////////////////

  // var collisionRedirect = cuboidCollisionCheck(newBalls[i].position, global, a.size);
  var collisionRedirect = cylinderCollisionCheck(newBall.position, global, a.size);

  let velocityFactor = - dot(newBall.velocity, collisionRedirect) / dot(collisionRedirect, collisionRedirect);

  collisionRedirect *= (2 - global.wallDissipation);

  for (var o=0u; o<3; o++) {
    if collisionRedirect[o] != 0 {
      newBall.position[o] += collisionRedirect[o];
      newBall.velocity[o] += collisionRedirect[o] * velocityFactor;
    }
  }

  balls[i] = newBall;
}