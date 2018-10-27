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

  return gulp
    .src("./src/**/*.css")
    .pipe(
      postcss([
        autoprefixer({
          browsers: ["> 0.5% in US", "last 2 versions", "not ie <= 10"],
        }),
      ])
    )
    .pipe(gulp.dest(dist));
}

/**
 * Copy over HTML files.
 */
function html() {
  return gulp.src("./src/**/*.html").pipe(gulp.dest(dist));
}

/**
 * Transpile TS and bundle dependencies.
 */
function js() {
  var webpack = require("webpack");
  var webpackConfig = require("./webpack.config");
  return new Promise((resolve, reject) => {
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
exports.build = gulp.series(clean, gulp.parallel(html, css, js));
