.PHONY: publish verify

# SERIAL deploy: the golden-path -T1C parallel default in .mvn/maven.config DEADLOCKS
# with the central-publishing + maven-gpg plugins; build-cache off avoids phantom-greens.
publish:
	./mvnw -T1 clean deploy -Prelease -Dmaven.build.cache.enabled=false

# Serial full-reactor test (cache off so a stale cache can never report a phantom green).
verify:
	./mvnw -T1 test -Dmaven.build.cache.enabled=false
