from __future__ import annotations

RMSNORM_SHIM = """\
import torch

if not hasattr(torch.nn, "RMSNorm"):
  class RMSNorm(torch.nn.Module):
    def __init__(
      self,
      normalized_shape,
      eps: float = 1e-5,
      elementwise_affine: bool = True,
      device=None,
      dtype=None,
    ) -> None:
      super().__init__()
      if isinstance(normalized_shape, int):
        normalized_shape = (normalized_shape,)
      self.normalized_shape = tuple(normalized_shape)
      self.eps = eps
      self.elementwise_affine = elementwise_affine
      if elementwise_affine:
        self.weight = torch.nn.Parameter(
          torch.ones(self.normalized_shape, device=device, dtype=dtype)
        )
      else:
        self.register_parameter("weight", None)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
      dims = tuple(range(-len(self.normalized_shape), 0))
      scale = torch.rsqrt(x.pow(2).mean(dim=dims, keepdim=True) + self.eps)
      x = x * scale
      if self.weight is None:
        return x
      return x * self.weight

  torch.nn.RMSNorm = RMSNorm  # type: ignore[attr-defined]
"""


def ensure_rmsnorm() -> None:
  exec(RMSNORM_SHIM, {})
