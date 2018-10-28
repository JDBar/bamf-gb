const gulp = require("gulp");
const dist = "./dist";

/**
 * Watch
 */
function watch() {
  gulp.watch(["./src/**/*.ts", "./src/**/*.js"], js);
  gulp.watch(["./src/**/*.css"], css);
  gulp.watch(["./src/**/*.html"], html);
}

/**
 * Clean
 */
function clean() {
  var del = require("del");
  return del([`${dist}/**`, `!${dist}`]);
}

/**
 * Compile CSS
 */
function css() {
  var postcss = require("gulp-postcss");
  var autoprefixer = require("autoprefixer");
  var del = require("del");

  return new Promise(async (resolve, reject) => {
    await del([`${dist}/**/*.css`, `!${dist}`]);
    gulp
      .src("./src/**/*.css")
      .pipe(
        postcss([
          autoprefixer({
            browsers: ["> 0.5% in US", "last 2 versions", "not ie <= 10"],
          }),
        ])
      )
      .pipe(gulp.dest(dist))
      .on("end", resolve)
      .on("error", reject);
  });
}

/**
 * Copy over HTML files.
 */
async function html() {
  var del = require("del");

  return new Promise(async (resolve, reject) => {
    await del([`${dist}/**/*.html`, `!${dist}`]);
    gulp
      .src("./src/**/*.html")
      .pipe(gulp.dest(dist))
      .on("end", resolve)
      .on("error", reject);
  });
}

/**
 * Transpile TS and bundle dependencies.
 */
async function js() {
  var webpack = require("webpack");
  var webpackConfig = require("./webpack.config");
  var del = require("del");

  return new Promise(async (resolve, reject) => {
    await del([`${dist}/**/*.js`, `!${dist}`]);
    webpack(webpackConfig, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

exports.watch = watch;
exports.clean = clean;
exports.css = css;
exports.html = html;
exports.js = js;
exports.build = gulp.parallel(html, css, js);
