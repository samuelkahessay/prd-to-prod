import { toPng } from "html-to-image";

export async function exportCardAsPng(
  element: HTMLElement,
  username: string
): Promise<void> {
  const dataUrl = await toPng(element, {
    width: 800,
    height: 1120,
    pixelRatio: 2,
    fetchRequestInit: { mode: "cors" },
  });

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `devcard-${username}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
