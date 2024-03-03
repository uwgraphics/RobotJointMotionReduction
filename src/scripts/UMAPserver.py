from flask import Flask, request, jsonify
from flask_cors import CORS  # Import CORS from flask_cors
import umap
import numpy as np
from umap.umap_ import nearest_neighbors
from umap.parametric_umap import ParametricUMAP
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/api/data', methods=['POST'])
def receive_data():
    data = request.get_json()
    print("Received data", " type is ", data["type"])
    embedding = embedding_UMAP(data["type"], data["nneighbors"], data["min_dis"], data["spread"], data["random_seed"], data["data"], data["loss_weight"], data["autoencoder"])
    
    (nneighbors_HD, nneighbors_HD_dis) = calc_nneighbor(data["nneighbors"], data["random_seed"], np.array(data["data"]))
    (nneighbors_2D, nneighbors_2D_dis) = calc_nneighbor(data["nneighbors"], data["random_seed"], embedding)
    nneighbors_HD = nneighbors_HD.tolist()
    nneighbors_HD_dis = nneighbors_HD_dis.tolist()
    nneighbors_2D = nneighbors_2D.tolist()
    nneighbors_2D_dis = nneighbors_2D_dis.tolist()
    embedding = embedding.tolist()
    print("computation done")
    # Process the data as needed
    return jsonify({"UMAPData": embedding, "nneighbors_HD": nneighbors_HD, "nneighbors_HD_dis": nneighbors_HD_dis,
                    "nneighbors_2D": nneighbors_2D, "nneighbors_2D_dis": nneighbors_2D_dis})


def embedding_UMAP(type_UMAP, nneighbors, min_dis, spread, random_seed, data, loss_weight, autoencoder):
    if type_UMAP == "Parametric":
        embedder = ParametricUMAP(global_correlation_loss_weight=loss_weight, autoencoder_loss = autoencoder)
    else:
        embedder = umap.UMAP(n_neighbors=nneighbors, min_dist=min_dis, spread=spread, random_state=random_seed)
    # embedding = reducer.fit_transform(data)
    embedding = embedder.fit_transform(data)
    return embedding

def calc_nneighbor(nneighbors, random_seed, data):
    (knn, knn_dis, tree) = nearest_neighbors(data,
                              n_neighbors=nneighbors,
                              metric="euclidean",
                              metric_kwds=None,
                              angular=False,
                              random_state=random_seed,)
    return (knn, knn_dis)


if __name__ == '__main__':
    app.run(port=5000)