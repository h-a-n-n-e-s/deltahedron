
// calculate the inward normal redirection vector for different boundary shapes

fn cuboidCollisionCheck(point:vec3f, global:GlobalParameter, offset:f32) -> vec3f {

  let bound = global.bound - offset;

  var redirect: vec3f;

  for (var o=0u; o<3; o++) {

    var tmp = - bound[o] - point[o];
    if tmp > 0 {
      redirect[o] = tmp;
      continue;
    }
    tmp = bound[o] - point[o];
    if tmp < 0 {
      redirect[o] = tmp;
    }

  }

  return redirect;
}

fn cylinderCollisionCheck(point:vec3f, global:GlobalParameter, offset:f32) -> vec3f {

  // global.bound indices: 0 outer radius, 1 vertical bound, 2 inner radius

  var redirect: vec3f;

  let radius = length(point.xz);
  
  // outer radial boundary
  var tmp = radius - global.bound[0] + offset;
  if tmp > 0 {
    redirect[0] = - tmp * point[0] / radius;
    redirect[2] = - tmp * point[2] / radius;
  }

  // vertical boundary
  tmp = - global.bound[1] - point[1] + offset;
  if tmp > 0 {
    redirect[1] = tmp;
  }
  tmp = global.bound[1] - point[1] - offset;
  if tmp < 0 {
    redirect[1] = tmp;
  }

  // inner radial boundary (if it exists)
  if global.bound[2] > 0 {
    tmp = global.bound[2] - radius + offset;
    if tmp > 0 {
      redirect[0] = tmp * point[0] / radius;
      redirect[2] = tmp * point[2] / radius;
    }
  }

  return redirect;
}

fn sphereCollisionCheck(point:vec3f, sphereCenterPosition:vec3f, sphereRadius:f32) -> vec3f {

  var redirect: vec3f;

  let radius = length(point - sphereCenterPosition);

  if radius < sphereRadius {
    redirect = (point - sphereCenterPosition) * (sphereRadius - radius) / radius;
  }

  return redirect;
}


// collision times ////////////////////////////////////////////////////////////

struct WallCollision {
  time: f32,
  index: i32
}

fn cuboidCollision(position:vec3f, velocity:vec3f, global:GlobalParameter, offset:f32, timeStep:f32) -> WallCollision {

  let bound = global.bound - offset;

  var wallCollision: WallCollision;

  wallCollision.time = timeStep;

  for (var o=0; o<3; o++) {

    let t = (bound[o] - abs(position[o])) / abs(velocity[o]);

    if position[o] * velocity[o] > 0 && t < wallCollision.time {
      wallCollision.time = t;
      wallCollision.index = o;
    }
  
  }

  return wallCollision;
}