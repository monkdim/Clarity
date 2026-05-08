/*
 * Freestanding QuickJS host (Phase 66 task 1).
 *
 * Thin C entry point that boots a QuickJS context, registers the
 * __claritos_syscall bridge (host_shim.zig), evaluates the bundled
 * Clarity runtime + transpiled stdlib, and calls main().
 *
 * Build (when zig + the QuickJS source tree are available):
 *
 *   zig cc -O2 -std=c11 -ffreestanding -nostdlib \
 *       -I third_party/quickjs \
 *       quickjs_main.c host_shim.o libquickjs.a \
 *       -o clarity-runtime
 *
 * The kernel loads the resulting binary at /bin/clarity-init and
 * spawns it as the first user process.
 */

#include "quickjs.h"

extern long claritos_syscall(unsigned long nr,
                             unsigned long a0, unsigned long a1, unsigned long a2,
                             unsigned long a3, unsigned long a4, unsigned long a5);
extern long claritos_write(int fd, const char *buf, unsigned long len);
extern void claritos_exit(int code);

/* Bundled by the build step — clarity-entry.js + runtime + stdlib. */
extern const char clarity_bundle_js[];
extern const unsigned long clarity_bundle_js_len;

static JSValue js_print(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    (void)this_val;
    for (int i = 0; i < argc; i++) {
        if (i > 0) claritos_write(1, " ", 1);
        const char *s = JS_ToCString(ctx, argv[i]);
        if (s) {
            unsigned long n = 0;
            while (s[n]) n++;
            claritos_write(1, s, n);
            JS_FreeCString(ctx, s);
        }
    }
    claritos_write(1, "\n", 1);
    return JS_UNDEFINED;
}

static JSValue js_syscall(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    (void)this_val;
    unsigned long args[7] = {0};
    for (int i = 0; i < argc && i < 7; i++) {
        long long v = 0;
        if (JS_IsNumber(argv[i])) {
            JS_ToInt64(ctx, &v, argv[i]);
        } else if (JS_IsString(argv[i])) {
            const char *s = JS_ToCString(ctx, argv[i]);
            v = (long long)(unsigned long)s;
            /* Caller is responsible for the lifetime of any pointer
             * args — JS strings free underneath. Here we leak; the
             * full implementation copies into a per-call arena. */
        }
        args[i] = (unsigned long)v;
    }
    long rc = claritos_syscall(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
    return JS_NewInt64(ctx, rc);
}

int _start(void) {
    JSRuntime *rt = JS_NewRuntime();
    JSContext *ctx = JS_NewContext(rt);

    JSValue global = JS_GetGlobalObject(ctx);
    JS_SetPropertyStr(ctx, global, "print",
                      JS_NewCFunction(ctx, js_print, "print", 1));
    JS_SetPropertyStr(ctx, global, "__claritos_syscall",
                      JS_NewCFunction(ctx, js_syscall, "__claritos_syscall", 7));
    JS_FreeValue(ctx, global);

    JSValue result = JS_Eval(ctx, clarity_bundle_js, clarity_bundle_js_len,
                             "<bundle>", JS_EVAL_TYPE_MODULE);
    if (JS_IsException(result)) {
        const char *msg = "[runtime] eval failed\n";
        unsigned long n = 0;
        while (msg[n]) n++;
        claritos_write(2, msg, n);
        claritos_exit(1);
    }
    JS_FreeValue(ctx, result);

    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    claritos_exit(0);
    return 0;
}
