@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(1) var<storage, read> halfEdges: array<HalfEdge>;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;
@group(0) @binding(4) var<storage, read_write> rods: array<Object>;
@group(0) @binding(5) var<storage, read_write> out: array< atomic<i32> >;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  if i >= global.rodCount {return;}

  // content of out buffer:
  // 0 minimal distance to camera
  // 1 index of closest rod
  // 2 maximum error
  // 3 dihedral angle
  // 4,5,6 centroid x,y,z
  // 7 volume

  // if abs(dihedralAngle(i)) < 0.9 {
  //   rods[i].color = vec4f(0.1,0.1,.1,1.0);
  // }

  if global.rodScanBranch == 1 {

    // check if this rod was hit first
    if rods[i].prop3 == atomicLoad(&out[0]) {

      // rods[i].color = vec4f(1,0,1,1);

      // out[1] = i32(i);
      atomicStore(&out[1], i32(i));

      atomicStore(&out[3], i32(dihedralAngle(i) * QUANTIZE_FACTOR));

      // possible new ball
      balls[global.ballCount].position = rods[i].position;
    }

  }
  else if global.rodScanBranch == 2 {

    // check if this rod will get the next ball
    if i == global.newBallRodIndex {
      balls[global.ballCount].position = rods[i].position;
    }
  }
  else if global.rodScanBranch == 3 {

    // find max error
    atomicMax(&out[2], rods[i].prop4);
  }
}

// compute dihedral angle for edge with index i
fn dihedralAngle(i:u32) -> f32 {

  let e = halfEdges[2 * i];
  let f = halfEdges[2 * i + 1];

  let j = e.vertex;
  let k = f.vertex;
  let l = halfEdges[e.next].vertex;
  let m = halfEdges[f.next].vertex;

  let a = balls[j].position;

  let r = balls[k].position - a;
  let p = balls[l].position - a;
  let q = balls[m].position - a;

  let u = normalize(cross(r, p));
  let v = normalize(cross(r, q));

  // actual dihedral angle is with oposite sign but inconvenient
  let cosAngle = - dot(u, v);
  let sinAngle = dot(cross(u, v), r);
  let signum = sign(sinAngle);

  var dihedralAngle: f32;
  // use cos if pi/4 < angle < 3*pi/4
  if abs(cosAngle) < 0.707 {
    dihedralAngle = signum * acos(cosAngle);
  }
  // otherwise use sin for accuracy
  else {
    // angle < pi/4
    if cosAngle > 0 {
      dihedralAngle = asin(sinAngle);
    }
    // angle > 3*pi/4
    else {
      dihedralAngle = signum * (PI - abs(asin(sinAngle)));
    }
  }
  return 180.0 / PI * dihedralAngle;
}
