"""
Minimal numba stub for Lambda environments where numba/llvmlite are not available.

umap-learn uses numba for JIT-compiled distance functions. When numba is absent,
umap falls back to pure Python/scipy implementations automatically — but only if
the import doesn't raise. This stub satisfies all of umap's numba imports so the
fallback path is used instead of raising ImportError.

Install this before importing umap:
    import ml.numba_stub  # noqa: F401
"""

import sys
import types


def _noop_decorator(*args, **kwargs):
    """Return the function unchanged — replaces @njit, @jit, @vectorize, etc."""
    if len(args) == 1 and callable(args[0]) and not kwargs:
        return args[0]
    return lambda f: f


def _make_stub(name: str) -> types.ModuleType:
    mod = types.ModuleType(name)
    mod.__spec__ = None
    return mod


def install() -> None:
    """Inject numba stubs into sys.modules if numba is not already installed."""
    if "numba" in sys.modules:
        try:
            import numba  # noqa: F401
            return  # real numba is available
        except ImportError:
            pass

    # Core stub
    numba = _make_stub("numba")
    numba.njit = _noop_decorator
    numba.jit = _noop_decorator
    numba.vectorize = _noop_decorator
    numba.guvectorize = _noop_decorator
    numba.prange = range
    numba.float32 = float
    numba.float64 = float
    numba.int32 = int
    numba.int64 = int
    numba.boolean = bool
    numba.uint8 = int
    numba.uint32 = int
    numba.uint64 = int
    numba.optional = lambda t: t
    numba.config = _make_stub("numba.config")
    numba.config.DISABLE_JIT = True

    # Sub-modules umap references
    numba_types = _make_stub("numba.types")
    numba_typed = _make_stub("numba.typed")
    numba_typed.List = list
    numba_typed.Dict = dict
    numba_core = _make_stub("numba.core")
    numba_core_types = _make_stub("numba.core.types")
    numba_extending = _make_stub("numba.extending")
    numba_extending.overload = _noop_decorator
    numba_extending.register_jitable = _noop_decorator
    numba_np = _make_stub("numba.np")
    numba_np_unsafe = _make_stub("numba.np.unsafe")
    numba_np_unsafe_ndarray = _make_stub("numba.np.unsafe.ndarray")
    numba_np_unsafe_ndarray.to_fixed_tuple = lambda a, n: tuple(a)

    sys.modules.update({
        "numba": numba,
        "numba.types": numba_types,
        "numba.typed": numba_typed,
        "numba.core": numba_core,
        "numba.core.types": numba_core_types,
        "numba.extending": numba_extending,
        "numba.np": numba_np,
        "numba.np.unsafe": numba_np_unsafe,
        "numba.np.unsafe.ndarray": numba_np_unsafe_ndarray,
    })


# Auto-install when this module is imported
install()
