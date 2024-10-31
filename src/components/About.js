import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGithub,
  faXTwitter,
  faDev,
} from "@fortawesome/free-brands-svg-icons";

const About = ({ onClose }) => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90">
      <div className="max-w-lg p-8 bg-white rounded ">
        <h2 className="mb-4 text-2xl font-bold">About</h2>
        <p className="mb-4">
          SAVA allows users to share their mood and location to create a
          collective mood map.
        </p>
        <p className="mb-4">
          It has been built over the indexus protocol to demonstrate its
          efficiency and scalability.
        </p>
        <p className="mb-4">
          Indexus is decentralized meaning no entity can claim the data
          ownership and therefore individuals, communities, and companies can
          cooperate without intermediaries.
        </p>
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 mt-4 text-white rounded bg-primary"
          >
            Close
          </button>
          <div className="flex mt-4 space-x-4">
            <a
              href="https://indexus.io/portfolio"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon={faDev} size="2x" />
            </a>
            <a
              href="https://github.com/indexus"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon={faGithub} size="2x" />
            </a>
            <a
              href="https://twitter.com/indexusio"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon={faXTwitter} size="2x" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
