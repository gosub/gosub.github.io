serve:
	cd site && hugo serve

build:
	cd site && hugo build

clean:
	rm -rf site/content site/.hugo_build.lock site/resources site/static/*
	rm -rf docs/*

.PHONY: serve clean build
