clean:
	rm -rf site/content site/.hugo_build.lock site/resources site/static/*
	rm -rf docs/*

build:
	cd site && hugo build

serve:
	cd site && hugo serve

.PHONY: clean build
