# Dipakai di MSYS2 (UCRT64/MINGW64) maupun Linux. Butuh gcc dan GMP.
CC      = gcc
CFLAGS  = -O2 -std=c11 -Wall -Wextra
LDLIBS  = -lgmp -lm
CORE    = src/util.c src/crt.c src/ab.c src/shamir.c

all: bin/test bin/bench bin/demo bin/export_moduli bin/biaya_inversi bin/rincian bin/keamanan

bin/test: src/test.c $(CORE) src/*.h
	@mkdir -p bin results
	$(CC) $(CFLAGS) -o $@ src/test.c $(CORE) $(LDLIBS)

bin/bench: src/bench.c $(CORE) src/*.h
	@mkdir -p bin results
	$(CC) $(CFLAGS) -DFLAGS_KOMPILASI='"$(CFLAGS)"' -o $@ src/bench.c $(CORE) $(LDLIBS)

bin/demo: src/demo.c $(CORE) src/*.h
	@mkdir -p bin results
	$(CC) $(CFLAGS) -o $@ src/demo.c $(CORE) $(LDLIBS)

bin/export_moduli: src/export_moduli.c $(CORE) src/*.h
	@mkdir -p bin results
	$(CC) $(CFLAGS) -o $@ src/export_moduli.c $(CORE) $(LDLIBS)

bin/biaya_inversi: src/biaya_inversi.c $(CORE) src/*.h
	@mkdir -p bin results
	$(CC) $(CFLAGS) -o $@ src/biaya_inversi.c $(CORE) $(LDLIBS)

bin/rincian: src/rincian.c $(CORE) src/*.h
	@mkdir -p bin results
	$(CC) $(CFLAGS) -o $@ src/rincian.c $(CORE) $(LDLIBS)

bin/keamanan: src/keamanan.c $(CORE) src/*.h
	@mkdir -p bin results
	$(CC) $(CFLAGS) -o $@ src/keamanan.c $(CORE) $(LDLIBS)

test: bin/test
	./bin/test

rincian: bin/rincian
	./bin/rincian

keamanan: bin/keamanan
	./bin/keamanan

# uji ulang dengan ambang jalur dipaksa: hampir semua lewat jalur mpz, lalu hampir semua lewat cara lama
test-jalur: src/test.c $(CORE) src/*.h
	@mkdir -p bin
	$(CC) $(CFLAGS) -DUJI_JALUR_PAKSA -DCRT_EKSAK_BIT_WORD=8 -DCRT_EKSAK_BATAS_PAKSA=1000000 -o bin/test_jalur_mpz src/test.c $(CORE) $(LDLIBS)
	$(CC) $(CFLAGS) -DUJI_JALUR_PAKSA -DCRT_EKSAK_BIT_WORD=0 -DCRT_EKSAK_BATAS_PAKSA=0 -o bin/test_jalur_lama src/test.c $(CORE) $(LDLIBS)
	./bin/test_jalur_mpz | tail -2
	./bin/test_jalur_lama | tail -2

# AddressSanitizer dan UBSan (Linux atau WSL; MSYS2 UCRT64 tidak menyediakan sanitizer)
test-sanitasi: src/test.c $(CORE) src/*.h
	@mkdir -p bin
	$(CC) -O1 -g -std=c11 -fsanitize=address,undefined -fno-omit-frame-pointer -o bin/test_sanitasi src/test.c $(CORE) $(LDLIBS)
	./bin/test_sanitasi | tail -2

demo: bin/demo
	./bin/demo

biaya: bin/biaya_inversi
	./bin/biaya_inversi

# benchmark penuh (30 rep x 50 inner, semua konfigurasi) lalu grafik
bench: bin/bench
	./bin/bench --reps 30 --inner 50 --warmup 3 --seed 12345
	python scripts/plot_results.py results/bench.csv results/sizes.csv results

# eksperimen tambahan: n tetap, k = n, L lebih rapat, data dingin (beberapa menit)
tambahan: bin/bench
	./bin/bench --paket tambahan --seed 12345

# tulis ulang web/js/hasil_c.js dari results/*.csv (isi nama laptop lewat MESIN="...")
MESIN ?= laptop uji
web:
	python scripts/buat_hasil_js.py --mesin "$(MESIN)"

# semua pengukuran untuk makalah, berurutan, dengan log di results/ (sekitar 15 menit)
hasil: bin/test bin/bench bin/demo bin/biaya_inversi bin/rincian bin/keamanan
	./bin/test | tee results/test_console.txt
	./bin/demo | tee results/demo_console.txt
	./bin/biaya_inversi | tee results/biaya_console.txt
	./bin/keamanan | tee results/keamanan_console.txt
	./bin/rincian | tee results/rincian_console.txt
	./bin/rincian --koprima | tee results/rincian_koprima_console.txt
	./bin/bench --reps 30 --inner 50 --warmup 3 --seed 12345 --inti 2 | tee results/bench_console.txt
	./bin/bench --reps 30 --inner 50 --warmup 3 --seed 12345 --inti 2 --out results/bench_run2.csv --sizes results/sizes_run2.csv | tee results/bench_run2_console.txt
	./bin/bench --reps 30 --inner 50 --warmup 3 --seed 12345 --inti 2 --out results/bench_run3.csv --sizes results/sizes_run3.csv | tee results/bench_run3_console.txt
	./bin/bench --paket koprima --reps 30 --inner 50 --warmup 3 --seed 12345 --inti 2 | tee results/koprima_console.txt
	./bin/bench --paket tambahan --seed 12345 --inti 2 | tee results/tambahan_console.txt
	python scripts/plot_results.py results/bench.csv results/sizes.csv results

# versi cepat untuk mencoba
bench-quick: bin/bench
	./bin/bench --reps 5 --inner 10 --warmup 1 --max-n 20 --out results/quick.csv --sizes results/quick_sizes.csv

# tulis ulang web/js/modulus.js dari program C (modulus sama dengan bin/bench)
moduli: bin/export_moduli
	./bin/export_moduli > web/js/modulus.js

clean:
	rm -rf bin

.PHONY: all test test-jalur test-sanitasi demo biaya bench tambahan rincian keamanan web hasil bench-quick moduli clean
