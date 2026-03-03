(function () {
  var canvas = document.getElementById('logo');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width;   // 100
  var H = canvas.height;  // 100

  function clip(draw) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
    ctx.clip();
    draw();
    ctx.restore();
  }

  // ── Plasma ────────────────────────────────────────────────────────────────

  var plasma = {
    init: function (ctx, W, H, clip) {
      this.ctx  = ctx;
      this.W    = W;
      this.H    = H;
      this.clip = clip;
      this.time = 0;
      this.img  = ctx.createImageData(W, H);

      this.hslToRgb = function (h, s, l) {
        h = h / 360;
        var r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
          }
          var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          var p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      };
    },

    draw: function () {
      var ctx = this.ctx, W = this.W, H = this.H;
      var cx = W / 2, cy = H / 2;
      var d = this.img.data;
      var t = this.time;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var dx = x - cx;
          var dy = y - cy;
          var dist = Math.sqrt(dx * dx + dy * dy);
          var v = Math.sin(x / 8 + t)
                + Math.sin(y / 6 + 0.7 * t)
                + Math.sin((x + y) / 10 + 1.3 * t)
                + Math.sin(dist / 6 + t);
          var hue = ((v + 4) / 8) * 360;
          var rgb = this.hslToRgb(hue, 1, 0.5);
          var i = (y * W + x) * 4;
          d[i]     = rgb[0];
          d[i + 1] = rgb[1];
          d[i + 2] = rgb[2];
          d[i + 3] = 255;
        }
      }
      var img = this.img;
      this.clip(function () { ctx.putImageData(img, 0, 0); });
      this.time += 0.05;
    }
  };

  // ── Fire ──────────────────────────────────────────────────────────────────

  var fire = {
    init: function (ctx, W, H, clip) {
      this.ctx  = ctx;
      this.W    = W;
      this.H    = H;
      this.clip = clip;
      this.buf  = new Uint8Array(W * H);
      this.img  = ctx.createImageData(W, H);

      this.palette = function (v) {
        var t;
        if (v < 90) {
          t = v / 90;
          return [255, 255, Math.round(255 * (1 - t))];
        } else if (v < 160) {
          t = (v - 90) / 70;
          return [255, Math.round(255 * (1 - t)), 0];
        } else if (v < 210) {
          t = (v - 160) / 50;
          return [Math.round(255 + t * (100 - 255)), 0, Math.round(t * 200)];
        } else {
          t = (v - 210) / 45;
          return [Math.round(100 * (1 - t)), 0, Math.round(200 * (1 - t))];
        }
      };
    },

    draw: function () {
      var ctx = this.ctx, W = this.W, H = this.H;
      var buf = this.buf;
      // Seed bottom row
      for (var x = 0; x < W; x++) {
        if (Math.random() < 0.4) {
          buf[(H - 1) * W + x] = 170 + Math.floor(Math.random() * 86);
        }
      }
      // Propagate upward
      for (var y = 0; y < H - 1; y++) {
        for (var x = 0; x < W; x++) {
          var xl = x > 0 ? x - 1 : W - 1;
          var xr = x < W - 1 ? x + 1 : 0;
          var avg = (buf[(y + 1) * W + xl]
                   + buf[(y + 1) * W + x]
                   + buf[(y + 1) * W + xr]) / 3;
          buf[y * W + x] = Math.max(0, Math.round(avg) - 2);
        }
      }
      // Render
      var d = this.img.data;
      for (var i = 0; i < W * H; i++) {
        var rgb = this.palette(buf[i]);
        d[i * 4]     = rgb[0];
        d[i * 4 + 1] = rgb[1];
        d[i * 4 + 2] = rgb[2];
        d[i * 4 + 3] = 255;
      }
      var img = this.img;
      this.clip(function () { ctx.putImageData(img, 0, 0); });
    }
  };

  // ── Game of Life ──────────────────────────────────────────────────────────

  var life = {
    init: function (ctx, W, H, clip) {
      this.ctx  = ctx;
      this.W    = W;
      this.H    = H;
      this.clip = clip;
      this.LW   = Math.floor(W / 3);
      this.LH   = Math.floor(H / 3);
      this.cells = new Uint8Array(this.LW * this.LH);
      this.next  = new Uint8Array(this.LW * this.LH);
      this.img   = ctx.createImageData(W, H);
      this.BG_R  = 0xff; this.BG_G = 0xff; this.BG_B = 0xff;
      this.FG_R  = 0x2b; this.FG_G = 0xbc; this.FG_B = 0x8a;
      this._seed();
    },

    _seed: function () {
      for (var i = 0; i < this.LW * this.LH; i++) {
        this.cells[i] = Math.random() < 0.3 ? 1 : 0;
      }
    },

    draw: function () {
      var ctx = this.ctx, W = this.W;
      var LW = this.LW, LH = this.LH;
      var cells = this.cells, next = this.next;
      var pop = 0;
      for (var y = 0; y < LH; y++) {
        for (var x = 0; x < LW; x++) {
          var yn = y > 0 ? y - 1 : LH - 1;
          var ys = y < LH - 1 ? y + 1 : 0;
          var xw = x > 0 ? x - 1 : LW - 1;
          var xe = x < LW - 1 ? x + 1 : 0;
          var n = cells[yn * LW + xw] + cells[yn * LW + x] + cells[yn * LW + xe]
                + cells[y  * LW + xw]                      + cells[y  * LW + xe]
                + cells[ys * LW + xw] + cells[ys * LW + x] + cells[ys * LW + xe];
          var alive = cells[y * LW + x];
          next[y * LW + x] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
          pop += next[y * LW + x];
        }
      }
      // Swap buffers
      this.cells = next;
      this.next  = cells;

      if (pop < LW * LH * 0.05) this._seed();

      // Render each cell as a 3×3 pixel block
      var d = this.img.data;
      var BG_R = this.BG_R, BG_G = this.BG_G, BG_B = this.BG_B;
      var FG_R = this.FG_R, FG_G = this.FG_G, FG_B = this.FG_B;
      for (var cy = 0; cy < LH; cy++) {
        for (var cx = 0; cx < LW; cx++) {
          var on = this.cells[cy * LW + cx];
          var r = on ? FG_R : BG_R;
          var g = on ? FG_G : BG_G;
          var b = on ? FG_B : BG_B;
          for (var dy = 0; dy < 3; dy++) {
            for (var dx = 0; dx < 3; dx++) {
              var pi = ((cy * 3 + dy) * W + (cx * 3 + dx)) * 4;
              d[pi]     = r;
              d[pi + 1] = g;
              d[pi + 2] = b;
              d[pi + 3] = 255;
            }
          }
        }
      }
      var img = this.img;
      this.clip(function () { ctx.putImageData(img, 0, 0); });
    }
  };

  // ── Engine ────────────────────────────────────────────────────────────────

  var effects = [plasma, fire, life];
  var current = effects[Math.floor(Math.random() * effects.length)];
  current.init(ctx, W, H, clip);
  (function loop() { current.draw(); requestAnimationFrame(loop); })();
})();
