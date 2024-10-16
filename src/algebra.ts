
export const vec3 = {

  midpoint(a:Float32Array, b:Float32Array) {
    const o = new Float32Array(3);

    o[0] = (a[0] + b[0])/2;
    o[1] = (a[1] + b[1])/2;
    o[2] = (a[2] + b[2])/2;

    return o;
  },

  subtract(a:Float32Array, b:Float32Array) {
    const o = new Float32Array(3);

    o[0] = a[0] - b[0];
    o[1] = a[1] - b[1];
    o[2] = a[2] - b[2];

    return o;
  },

  length(v:Float32Array) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  },

  normalize(v:Float32Array) {

    const length = this.length(v);

    if (length > 1e-5) {
      v[0] /= length;
      v[1] /= length;
      v[2] /= length;
    }
    else
      throw new Error('cannot normalize zero vector');
  },

  dot(a:Float32Array, b:Float32Array) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },

  cross(a:Float32Array, b:Float32Array) {
    return new Float32Array([
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ])
  },

  triple(a:Float32Array, b:Float32Array, c:Float32Array) {
    return this.dot(a, this.cross(b, c));
  },

  // returns rotation matrix for axis a and angle
  rotationMatrix(a:Float32Array, angle:number):Float32Array {
  
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const m = 1 - c;
    
    this.normalize(a);

    return new Float32Array([
      m*a[0]*a[0]+c,
      m*a[0]*a[1]-s*a[2],
      m*a[0]*a[2]+s*a[1],
      m*a[1]*a[0]+s*a[2],
      m*a[1]*a[1]+c,
      m*a[1]*a[2]-s*a[0],
      m*a[2]*a[0]-s*a[1],
      m*a[2]*a[1]+s*a[0],
      m*a[2]*a[2]+c 
    ]);
  },

  applyRotation(R:Float32Array, v:Float32Array) {
    const vx = R[0] * v[0] + R[1] * v[1] + R[2] * v[2];
    const vy = R[3] * v[0] + R[4] * v[1] + R[5] * v[2];
    const vz = R[6] * v[0] + R[7] * v[1] + R[8] * v[2];
    v.set([vx, vy, vz]);
  }
};



export const mat4 = {

  multiply(a:Float32Array, b:Float32Array, o:Float32Array) {

    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];

    const b00 = b[0];
    const b01 = b[1];
    const b02 = b[2];
    const b03 = b[3];
    const b10 = b[4];
    const b11 = b[5];
    const b12 = b[6];
    const b13 = b[7];
    const b20 = b[8];
    const b21 = b[9];
    const b22 = b[10];
    const b23 = b[11];
    const b30 = b[12];
    const b31 = b[13];
    const b32 = b[14];
    const b33 = b[15];

    // WGSL uses column-major order!
    
    o[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
    o[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
    o[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
    o[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;

    o[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
    o[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
    o[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
    o[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;

    o[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
    o[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
    o[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
    o[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;

    o[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
    o[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
    o[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
    o[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

    return o;
  },

  multiplyVector(a:Float32Array, v:Float32Array) {
    
    const o = new Float32Array(4);

    o[0] = v[0] * a[0] + v[1] * a[4] + v[2] * a[8]  + v[3] * a[12];
    o[1] = v[0] * a[1] + v[1] * a[5] + v[2] * a[9]  + v[3] * a[13];
    o[2] = v[0] * a[2] + v[1] * a[6] + v[2] * a[10] + v[3] * a[14];
    o[3] = v[0] * a[3] + v[1] * a[7] + v[2] * a[11] + v[3] * a[15];

    return o;
  },

  lookAtAndViewMatrix(eye:Float32Array, target:Float32Array, x:Float32Array, l:Float32Array, v:Float32Array) {

    const z = vec3.subtract(eye, target);
    vec3.normalize(z);
    const y = vec3.cross(z, x);

    // lookAt matrix
    l[0] = x[0]; l[4] = y[0]; l[ 8] = z[0]; l[12] = eye[0];
    l[1] = x[1]; l[5] = y[1]; l[ 9] = z[1]; l[13] = eye[1];
    l[2] = x[2]; l[6] = y[2]; l[10] = z[2]; l[14] = eye[2];
                                            l[15] = 1;

    // view matrix (inverse of lookAt matrix)
    v[0] = x[0]; v[4] = x[1]; v[ 8] = x[2]; v[12] = -x[0]*eye[0]-x[1]*eye[1]-x[2]*eye[2];
    v[1] = y[0]; v[5] = y[1]; v[ 9] = y[2]; v[13] = -y[0]*eye[0]-y[1]*eye[1]-y[2]*eye[2];
    v[2] = z[0]; v[6] = z[1]; v[10] = z[2]; v[14] = -z[0]*eye[0]-z[1]*eye[1]-z[2]*eye[2];
                                            v[15] = 1;
  }

};

// unit quaternion of a rotation from y-axis to direction of vector v
export const quaternionFromDirection = (v:Float32Array) => {
  const L = Math.sqrt(v[0]**2+v[1]**2+v[2]**2);
  const f = 1/Math.sqrt(2*L*(L+v[1]));
  return new Float32Array([v[2]*f, 0, -v[0]*f, (L+v[1])*f]);
}