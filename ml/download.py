"""Download and unpack MovieLens ml-latest-small into data/raw.

    python -m ml.download

Dataset: F. Maxwell Harper and Joseph A. Konstan. 2015. The MovieLens Datasets:
History and Context. ACM TiiS 5, 4. https://grouplens.org/datasets/movielens/
"""
import io
import zipfile

import requests

from ml.data import RAW

URL = "https://files.grouplens.org/datasets/movielens/ml-latest-small.zip"


def download():
    if (RAW / "ratings.csv").exists():
        print(f"Already present: {RAW}")
        return
    print(f"Downloading {URL} ...")
    resp = requests.get(URL, timeout=60)
    resp.raise_for_status()
    RAW.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        z.extractall(RAW.parent)
    print(f"Extracted to {RAW}")


if __name__ == "__main__":
    download()
